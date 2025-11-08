import { Controller, Get, Post, Body, Patch, Param, Delete, Query, BadRequestException } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto, ReservationStatus } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { Types } from 'mongoose';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  async create(@Body() createReservationDto: CreateReservationDto) {
    return this.reservationsService.create(createReservationDto);
  }
  
  // GET /reservations?userId=<mongoId>&status=<PENDING|CONFIRMED|CANCELLED>
  /*
  @Get()
  async listByUser(@Query('userId') userId: string, @Query('status') status?: ReservationStatus) {
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('userId inválido');
    }
    if (status && !['PENDING', 'CONFIRMED', 'CANCELLED'].includes(status)) {
      throw new BadRequestException('status inválido');
    }
    return this.reservationsService.listByUser(userId, status);
  }

  @Get()
  async findAll() {
    return this.reservationsService.findAll();
  }*/

   // Listado de toodo: GET /reservations?status=&page=&limit=
  @Get()
  async listAll(@Query('status') status?: ReservationStatus, @Query('page') page?: string, @Query('limit') limit?: string) {
    if (status && !['PENDING', 'CONFIRMED', 'CANCELLED'].includes(status)) {
      throw new BadRequestException('status inválido');
    }
    const p = Math.max(1, Number(page ?? 1));
    const l = Math.min(100, Math.max(1, Number(limit ?? 50)));
    return this.reservationsService.listAll({ status, page: p, limit: l });
  }
 
   // Listado por usuario id: GET /reservations/user/:userId?status=
  @Get('user/:userId')
  async listByUser(@Param('userId') userId: string, @Query('status') status?: ReservationStatus) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('userId inválido');
    }
    if (status && !['PENDING', 'CONFIRMED', 'CANCELLED'].includes(status)) {
      throw new BadRequestException('status inválido');
    }
    return this.reservationsService.listByUser(userId, status);
  }
 
  //Reserva en detalle: GET /reservations/:id
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.reservationsService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateReservationDto: UpdateReservationDto) {
    return this.reservationsService.update(id, updateReservationDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.reservationsService.remove(id);
  }
}

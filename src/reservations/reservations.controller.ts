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
  }

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

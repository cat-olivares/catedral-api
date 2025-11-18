import { Controller, Get, Post, Body, Patch, Param, Delete, Query, BadRequestException, Put } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto, ReservationStatus } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { Types } from 'mongoose';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) { }

  @Post()
  async create(@Body() createReservationDto: CreateReservationDto) {
    return this.reservationsService.create(createReservationDto);
  }

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

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateReservationDto: UpdateReservationDto) {
    return this.reservationsService.update(id, updateReservationDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.reservationsService.remove(id);
  }

  @Put(':id/complete')
  async complete(@Param('id') id: string) {
    console.log('[RES.CTRL] PUT /reservations/%s/complete', id);
    const updated = await this.reservationsService.update(id, {
      status: ReservationStatus.CONFIRMED,
    } as UpdateReservationDto);
    return updated;
  }

  // PUT /reservations/:id/cancel  -> status = CANCELLED
  @Put(':id/cancel')
  async cancel(@Param('id') id: string) {
    console.log('[RES.CTRL] PUT /reservations/%s/cancel', id);
    const updated = await this.reservationsService.update(id, {
      status: ReservationStatus.CANCELLED,
    } as UpdateReservationDto);
    return updated;
  }

    // GET /reservations/by-chat/:chatId -> preview para el header del chat
  @Get('by-chat/:chatId')
  async findByChat(@Param('chatId') chatId: string) {
    return this.reservationsService.findPreviewByChat(chatId);
  }

  //Reserva en detalle: GET /reservations/:id
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.reservationsService.findOne(id);
  }



}

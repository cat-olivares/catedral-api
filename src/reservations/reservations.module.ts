import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { ReservationDetail, ReservationDetailSchema } from './schemas/reservation-detail.schema';
import { Reservation, ReservationSchema } from './schemas/reservation.schema';
import { Product, ProductSchema } from 'src/products/schemas/product.schema';
import { Stock, StockSchema } from 'src/stock/schemas/stock.schema';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  controllers: [ReservationsController],
  providers: [ReservationsService],
  imports: [
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
    MongooseModule.forFeature([{ name: Stock.name, schema: StockSchema }]),
    MongooseModule.forFeature([{ name: ReservationDetail.name, schema:ReservationDetailSchema }]),
    MongooseModule.forFeature([{ name: Reservation.name, schema: ReservationSchema }]),
    NotificationsModule,
  ],
})
export class ReservationsModule {}

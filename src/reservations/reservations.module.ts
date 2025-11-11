import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { ReservationDetail, ReservationDetailSchema } from './schemas/reservation-detail.schema';
import { Reservation, ReservationSchema } from './schemas/reservation.schema';
import { Product, ProductSchema } from 'src/products/schemas/product.schema';
import { Stock, StockSchema } from 'src/stock/schemas/stock.schema';
import { User, UserSchema } from 'src/users/schemas/user.schema';
import { UsersModule } from 'src/users/users.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { ChatsModule } from 'src/chats/chats.module';

@Module({
  controllers: [ReservationsController],
  providers: [ReservationsService],
  imports: [
    UsersModule,
    NotificationsModule,
    ChatsModule,
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Stock.name, schema: StockSchema },
      { name: ReservationDetail.name, schema:ReservationDetailSchema },
      { name: Reservation.name, schema: ReservationSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
})
export class ReservationsModule {}

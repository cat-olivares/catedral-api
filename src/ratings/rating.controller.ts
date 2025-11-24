import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { RatingsService } from './rating.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  rate(@Req() req: any, @Body() dto: CreateRatingDto) {
    const userId =
      req.user?.userId ||
      req.user?._id ||
      req.user?.id ||
      req.user?.sub;

    console.log('[RatingsController] POST /ratings', { userId, dto });

    return this.ratingsService.rate(userId, dto);
  }
}

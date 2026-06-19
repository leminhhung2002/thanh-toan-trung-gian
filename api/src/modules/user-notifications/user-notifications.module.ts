import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { UserNotificationsController } from './user-notifications.controller';
import {
  DrizzleUserNotificationsRepository,
} from './user-notifications.repository';
import { UserNotificationsService } from './user-notifications.service';

@Module({
  imports: [DatabaseModule],
  controllers: [UserNotificationsController],
  providers: [
    UserNotificationsService,
    {
      provide: 'UserNotificationsRepository',
      useClass: DrizzleUserNotificationsRepository,
    },
  ],
  exports: [UserNotificationsService],
})
export class UserNotificationsModule {}

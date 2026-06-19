import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../platform/database/database.service';
import { users } from '../../platform/database/schema';

@Injectable()
export class PasswordConfirmationService {
  constructor(private readonly databaseService: DatabaseService) {}

  async assertValidCurrentPassword(
    userId: string,
    currentPassword: string | undefined,
  ) {
    if (!currentPassword || currentPassword.length === 0) {
      throw new UnauthorizedException({
        code: 'current_password_required',
        message: 'Vui lòng nhập mật khẩu hiện tại.',
      });
    }

    const [user] = await this.databaseService.db
      .select({
        id: users.id,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException({
        code: 'user_not_found',
        message: 'Không tìm thấy người dùng.',
      });
    }

    const valid = await argon2.verify(user.passwordHash, currentPassword);

    if (!valid) {
      throw new UnauthorizedException({
        code: 'current_password_invalid',
        message: 'Mật khẩu hiện tại không đúng.',
      });
    }
  }
}

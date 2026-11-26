import type {
  AccountRepository,
  UpdateProfileData,
} from "@/application/account/account-repository";
import type { PassengerProfile } from "@/domain/account/passenger-profile";
import { prisma } from "@/infrastructure/db/prisma";

const profileSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  photoUrl: true,
  privacyAcceptedAt: true,
} as const;

export class PrismaAccountRepository implements AccountRepository {
  async findById(userId: string): Promise<PassengerProfile | null> {
    return prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: profileSelect,
    });
  }

  async findByEmail(email: string): Promise<PassengerProfile | null> {
    return prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: profileSelect,
    });
  }

  async updateProfile(userId: string, data: UpdateProfileData): Promise<PassengerProfile> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        fullName: data.fullName,
        phone: data.phone,
      },
      select: profileSelect,
    });
  }
}

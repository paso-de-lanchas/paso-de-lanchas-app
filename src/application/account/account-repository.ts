import type { PassengerProfile } from "@/domain/account/passenger-profile";

export interface UpdateProfileData {
  fullName: string;
  phone: string | null;
}

export interface AccountRepository {
  findById(userId: string): Promise<PassengerProfile | null>;
  findByEmail(email: string): Promise<PassengerProfile | null>;
  updateProfile(userId: string, data: UpdateProfileData): Promise<PassengerProfile>;
}

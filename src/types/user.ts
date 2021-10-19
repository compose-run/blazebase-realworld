export type UId = string;

export interface PublicUser {
  username: string;
  bio: string | null;
  image: string | null;
  uid: UId;
}
export interface UserSettings extends PublicUser {
  email: string;
  password: string | null;
}

export interface UserForRegistration {
  username: string;
  email: string;
  password: string;
}

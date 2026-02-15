import { USER_STATUSES } from "../../../../helpers/enums/statuses.enum";

export interface IUser {
  id: string;
  fullName: string;
  userName: string;
  hashedPassword: string;
  status: USER_STATUSES;
  personalities: 
  createdAtEpoch: number;
  updatedAtEpoch: number;
}

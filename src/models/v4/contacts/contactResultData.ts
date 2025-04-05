import { type ContactCategoryResultData } from './contactCategoryResultData';

export enum ContactType {
  Person = 0,
  Company = 1,
}

export interface ContactResultData {
  ContactId: string;
  ContactType: ContactType;
  OtherName?: string;
  ContactCategoryId?: string;
  Category?: ContactCategoryResultData;
  FirstName?: string;
  MiddleName?: string;
  LastName?: string;
  CompanyName?: string;
  Email?: string;
  PhysicalAddressId?: number;
  MailingAddressId?: number;
  Website?: string;
  Twitter?: string;
  Facebook?: string;
  LinkedIn?: string;
  Instagram?: string;
  Threads?: string;
  Bluesky?: string;
  Mastodon?: string;
  LocationGpsCoordinates?: string;
  EntranceGpsCoordinates?: string;
  ExitGpsCoordinates?: string;
  LocationGeofence?: string;
  CountryIssuedIdNumber?: string;
  CountryIdName?: string;
  StateIdNumber?: string;
  StateIdName?: string;
  StateIdCountryName?: string;
  Description?: string;
  OtherInfo?: string;
  HomePhoneNumber?: string;
  CellPhoneNumber?: string;
  FaxPhoneNumber?: string;
  OfficePhoneNumber?: string;
  Image?: Uint8Array;
  IsDeleted: boolean;
  AddedOnUtc: Date;
  AddedOn?: string;
  AddedByUserId?: string;
  AddedByUserName?: string;
  EditedOnUtc?: Date;
  EditedOn?: string;
  EditedByUserId?: string;
  EditedByUserName?: string;
}

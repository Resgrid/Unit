export enum ContactType {
  Person = 0,
  Company = 1,
}

export interface ContactResultData {
  ContactId: string;
  Name: string;
  Type: ContactType;
  Email?: string;
  Phone?: string;
  Mobile?: string;
  Address?: string;
  City?: string;
  State?: string;
  Zip?: string;
  Notes?: string;
  ImageUrl?: string;
  IsImportant: boolean;
  CreatedOn: Date;
  UpdatedOn?: Date;
}

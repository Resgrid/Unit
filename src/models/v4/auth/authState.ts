import { AuthTokenModel } from "./authTokens";
import { ProfileModel } from "./profile";


export interface AuthStateModel {
  tokens?: AuthTokenModel;
  profile?: ProfileModel;
  authReady?: boolean;
}
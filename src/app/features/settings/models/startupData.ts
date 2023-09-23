import { LoginResult } from "src/app/models/loginResult";

export class StartupData  {
    public loginData: LoginResult = new LoginResult();
    public activeUnitId: string = '';
    public pushNotificationsEnabled: boolean = false;
    public themePreference: number = -1;
    public keepAlive: boolean = false;
    public headsetType: number = -1;
    public activeCallId: string = '';
    public backgroundGeolocationEnabled: boolean = false;
}

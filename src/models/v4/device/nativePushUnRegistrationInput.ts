/** Takes a native (iOS or Android) push token off the unit it was registered on (Core v4 Devices/UnRegisterNativePush). */
export class NativePushUnRegistrationInput {
  public Token: string = '';
  public Prefix: string = '';
  public UnitId: string = '';
}

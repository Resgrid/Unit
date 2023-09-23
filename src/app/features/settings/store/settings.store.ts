import { HeadsetType } from "src/app/models/headsetType";
import { UserInfo } from "src/app/models/userInfo";

export interface SettingsState {
    loggedIn: boolean;
    errorMsg: string;
    isLogging: boolean;
    user: UserInfo;
    enablePushNotifications: boolean;
    themePreference: number;
    keepAlive: boolean;
    headsetType: number;
    selectedMic: string;
    isAppActive: boolean;
    enableBackgroundGeolocation: boolean;
}

export const initialState: SettingsState = {
    loggedIn: false,
    errorMsg: null,
    isLogging: false,
    user: null,
    enablePushNotifications: false,
    themePreference: -1,
    keepAlive: false,
    headsetType: -1,
    selectedMic: "",
    isAppActive: true,
    enableBackgroundGeolocation: false
};

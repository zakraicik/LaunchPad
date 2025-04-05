import {initializeApp} from "firebase-admin/app";
initializeApp();

export * from "./alchemyWebhook";
export * from "./tokenRegistryProcessor";
export * from "./platformAdminProcessor";
export * from "./feeManagerProcessor";
export * from "./defiIntegrationManagerProcessor";
export * from "./CampaignFactoryProcessor";
export * from "./CampaignEventProcessor";

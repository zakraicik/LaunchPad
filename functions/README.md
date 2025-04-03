# DeFi Crowdfunding Platform Events Table

| Contract                    | Event Name                      | Operation                       | Triggered ✅ | Example file                   |
| --------------------------- | ------------------------------- | ------------------------------- | ------------ | ------------------------------ |
| **Campaign**                | _No direct events_              | N/A                             |              |                                |
| **CampaignContractFactory** | FactoryOperation                | OP_CAMPAIGN_CREATED (1)         |              |                                |
| **CampaignEventCollector**  | CampaignEventCollectorOperation | OP_FACTORY_AUTHORIZED (1)       |              |                                |
| **CampaignEventCollector**  | CampaignEventCollectorOperation | OP_FACTORY_DEAUTHORIZED (2)     |              |                                |
| **CampaignEventCollector**  | CampaignEventCollectorOperation | OP_CAMPAIGN_AUTHORIZED (3)      |              |                                |
| **CampaignEventCollector**  | CampaignEventCollectorOperation | OP_CAMPAIGN_DEAUTHORIZED (4)    |              |                                |
| **CampaignEventCollector**  | Contribution                    | N/A                             |              |                                |
| **CampaignEventCollector**  | RefundIssued                    | N/A                             |              |                                |
| **CampaignEventCollector**  | FundsClaimed                    | N/A                             |              |                                |
| **CampaignEventCollector**  | CampaignStatusChanged           | N/A                             |              |                                |
| **CampaignEventCollector**  | AdminOverrideSet                | N/A                             |              |                                |
| **CampaignEventCollector**  | FundsOperation                  | OP_DEPOSIT (1)                  |              |                                |
| **CampaignEventCollector**  | FundsOperation                  | OP_CLAIM_FUNDS (2)              |              |                                |
| **DefiIntegrationManager**  | DefiOperation                   | OP_DEPOSITED (1)                |              |                                |
| **DefiIntegrationManager**  | DefiOperation                   | OP_WITHDRAWN (2)                |              |                                |
| **DefiIntegrationManager**  | ConfigUpdated                   | OP_CONFIG_UPDATED (3)           |              |                                |
| **FeeManager**              | FeeManagerOperation             | OP_TREASURY_UPDATED (1)         | ✅           | update-treasury.ts             |
| **FeeManager**              | FeeManagerOperation             | OP_SHARE_UPDATED (2)            | ✅           | update-fee-share.ts            |
| **PlatformAdmin**           | PlatformAdminOperation          | OP_ADMIN_ADDED (1)              | ✅           | add-platform-admin.ts          |
| **PlatformAdmin**           | PlatformAdminOperation          | OP_ADMIN_REMOVED (2)            | ✅           | remove-platform-admin.ts       |
| **TokenRegistry**           | TokenRegistryOperation          | OP_TOKEN_ADDED (1)              | ✅           | add-token.ts                   |
| **TokenRegistry**           | TokenRegistryOperation          | OP_TOKEN_REMOVED (2)            | ✅           | remove-token.ts                |
| **TokenRegistry**           | TokenRegistryOperation          | OP_TOKEN_SUPPORT_DISABLED (3)   | ✅           | disable-token-support.ts       |
| **TokenRegistry**           | TokenRegistryOperation          | OP_TOKEN_SUPPORT_ENABLED (4)    | ✅           | enable-token-support.ts        |
| **TokenRegistry**           | TokenRegistryOperation          | OP_MIN_CONTRIBUTION_UPDATED (5) | ✅           | change-minimum-contribution.ts |

## Operation Type Codes

### CampaignContractFactory

- `OP_CAMPAIGN_CREATED = 1`: Campaign contract created

### CampaignEventCollector

- `OP_FACTORY_AUTHORIZED = 1`: Factory authorized to register campaigns
- `OP_FACTORY_DEAUTHORIZED = 2`: Factory authorization revoked
- `OP_CAMPAIGN_AUTHORIZED = 3`: Campaign authorized to emit events
- `OP_CAMPAIGN_DEAUTHORIZED = 4`: Campaign authorization revoked

### Campaign (via CampaignEventCollector)

- `OP_DEPOSIT = 1`: Funds deposited
- `OP_CLAIM_FUNDS = 2`: Funds claimed

### DefiIntegrationManager

- `OP_DEPOSITED = 1`: Tokens deposited to yield protocol
- `OP_WITHDRAWN = 2`: Tokens withdrawn from yield protocol
- `OP_CONFIG_UPDATED = 3`: Configuration updated

### FeeManager

- `OP_TREASURY_UPDATED = 1`: Platform treasury address updated
- `OP_SHARE_UPDATED = 2`: Platform fee share percentage updated

### PlatformAdmin

- `OP_ADMIN_ADDED = 1`: Platform admin added
- `OP_ADMIN_REMOVED = 2`: Platform admin removed

### TokenRegistry

- `OP_TOKEN_ADDED = 1`: Token added to registry
- `OP_TOKEN_REMOVED = 2`: Token removed from registry
- `OP_TOKEN_SUPPORT_DISABLED = 3`: Token support disabled
- `OP_TOKEN_SUPPORT_ENABLED = 4`: Token support enabled
- `OP_MIN_CONTRIBUTION_UPDATED = 5`: Minimum contribution amount updated

## Status and Reason Codes

### Campaign

- `STATUS_ACTIVE = 1`: Campaign is active
- `STATUS_COMPLETE = 2`: Campaign is complete
- `REASON_GOAL_REACHED = 1`: Status changed because goal was reached
- `REASON_DEADLINE_PASSED = 2`: Status changed because deadline passed

### CampaignContractFactory

- `STATUS_CREATED = 0`: Campaign initially created
- `STATUS_ACTIVE = 1`: Campaign active
- `REASON_CAMPAIGN_CREATED = 0`: Status changed because campaign was created

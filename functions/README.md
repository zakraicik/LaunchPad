# Firebase Collections Updated by Operation Codes

## CampaignContractFactory Events

| Operation Code            | Operation Name            | Firebase Collections Updated              | Frontend Integration |
| ------------------------- | ------------------------- | ----------------------------------------- | -------------------- |
| `OP_CAMPAIGN_CREATED (1)` | Campaign contract created | `rawEvents`, `factoryEvents`, `campaigns` | ✅                   |

## CampaignEventCollector Operations

| Operation Code                 | Operation Name                           | Firebase Collections Updated                                   | Frontend Integration |
| ------------------------------ | ---------------------------------------- | -------------------------------------------------------------- | -------------------- |
| `OP_FACTORY_AUTHORIZED (1)`    | Factory authorized to register campaigns | `rawEvents`, `eventCollectorOperations`, `authorizedFactories` | ✅                   |
| `OP_FACTORY_DEAUTHORIZED (2)`  | Factory authorization revoked            | `rawEvents`, `eventCollectorOperations`, `authorizedFactories` | ✅                   |
| `OP_CAMPAIGN_AUTHORIZED (3)`   | Campaign authorized to emit events       | `rawEvents`, `eventCollectorOperations`, `authorizedCampaigns` | ✅                   |
| `OP_CAMPAIGN_DEAUTHORIZED (4)` | Campaign authorization revoked           | `rawEvents`, `eventCollectorOperations`, `authorizedCampaigns` | ✅                   |

## Campaign Events (via CampaignEventCollector)

| Event Type              | Firebase Collections Updated                                                | Frontend Integration |
| ----------------------- | --------------------------------------------------------------------------- | -------------------- |
| `Contribution`          | `rawEvents`, `contributionEvents`, `campaigns` (updates totalContributions) | ✅                   |
| `RefundIssued`          | `rawEvents`, `refundEvents`, `campaigns` (updates totalRefunds)             |                      |
| `FundsClaimed`          | `rawEvents`, `claimEvents`, `campaigns` (updates totalClaims)               | ✅                   |
| `CampaignStatusChanged` | `rawEvents`, `campaignStatusEvents`, `campaigns` (updates status)           | ✅                   |
| `AdminOverrideSet`      | `rawEvents`, `adminOverrideEvents`, `campaigns` (updates adminOverride)     | ✅                   |
| `FundsOperation`        | `rawEvents`, `fundsOperationEvents`, `campaigns` (updates tokenBalances)    | ✅                   |

## Campaign Funds Operations (via CampaignEventCollector)

| Operation Code       | Operation Name  | Firebase Collections Updated                                               | Frontend Integration |
| -------------------- | --------------- | -------------------------------------------------------------------------- | -------------------- |
| `OP_DEPOSIT (1)`     | Funds deposited | `rawEvents`, `fundsOperationEvents`, `campaigns` (increases tokenBalances) | ✅                   |
| `OP_CLAIM_FUNDS (2)` | Funds claimed   | `rawEvents`, `fundsOperationEvents`, `campaigns` (decreases tokenBalances) | ✅                   |

## DefiIntegrationManager Operations

| Operation Code                          | Operation Name                                   | Firebase Collections Updated                                   | Frontend Integration |
| --------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------- | -------------------- |
| `OP_DEPOSITED (1)`                      | Tokens deposited to yield protocol               | `rawEvents`, `defiEvents`, `campaignYield`                     | ✅                   |
| `OP_WITHDRAWN_TO_CONTRACT (2)`          | Tokens withdrawn from yield protocol to contract | `rawEvents`, `defiEvents`, `campaignYield`, `withdrawalEvents` |                      |
| `OP_TOKEN_REGISTRY_UPDATED (3)`         | Token registry updated                           | `rawEvents`, `defiConfigEvents`, `defiConfig`                  | ✅                   |
| `OP_FEE_MANAGER_UPDATED (4)`            | Fee manager updated                              | `rawEvents`, `defiConfigEvents`, `defiConfig`                  | ✅                   |
| `OP_AAVE_POOL_UPDATED (5)`              | Aave pool updated                                | `rawEvents`, `defiConfigEvents`, `defiConfig`                  | ✅                   |
| `OP_WITHDRAWN_TO_PLATFORM_TREASURY (6)` | Tokens withdrawn to platform treasury            | `rawEvents`, `defiEvents`, `campaignYield`, `withdrawalEvents` |                      |

## FeeManager Operations

| Operation Code            | Operation Name                        | Firebase Collections Updated          | Frontend Integration |
| ------------------------- | ------------------------------------- | ------------------------------------- | -------------------- |
| `OP_TREASURY_UPDATED (1)` | Platform treasury address updated     | `rawEvents`, `feeEvents`, `feeConfig` | ✅                   |
| `OP_SHARE_UPDATED (2)`    | Platform fee share percentage updated | `rawEvents`, `feeEvents`, `feeConfig` | ✅                   |

## PlatformAdmin Operations

| Operation Code         | Operation Name         | Firebase Collections Updated         | Frontend Integration |
| ---------------------- | ---------------------- | ------------------------------------ | -------------------- |
| `OP_ADMIN_ADDED (1)`   | Platform admin added   | `rawEvents`, `adminEvents`, `admins` | ✅                   |
| `OP_ADMIN_REMOVED (2)` | Platform admin removed | `rawEvents`, `adminEvents`, `admins` | ✅                   |

## TokenRegistry Operations

| Operation Code                    | Operation Name                      | Firebase Collections Updated         | Frontend Integration |
| --------------------------------- | ----------------------------------- | ------------------------------------ | -------------------- |
| `OP_TOKEN_ADDED (1)`              | Token added to registry             | `rawEvents`, `tokenEvents`, `tokens` | ✅                   |
| `OP_TOKEN_REMOVED (2)`            | Token removed from registry         | `rawEvents`, `tokenEvents`, `tokens` | ✅                   |
| `OP_TOKEN_SUPPORT_DISABLED (3)`   | Token support disabled              | `rawEvents`, `tokenEvents`, `tokens` | ✅                   |
| `OP_TOKEN_SUPPORT_ENABLED (4)`    | Token support enabled               | `rawEvents`, `tokenEvents`, `tokens` | ✅                   |
| `OP_MIN_CONTRIBUTION_UPDATED (5)` | Minimum contribution amount updated | `rawEvents`, `tokenEvents`, `tokens` | ✅                   |

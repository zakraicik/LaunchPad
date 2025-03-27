# DeFi-Powered Fundraising Platform

A decentralized fundraising solution that allows campaign creators to raise funds for their projects while generating yield through DeFi protocols.

## Overview

This platform enables individuals to create fundraising campaigns for their projects with specific goals and duration. Funds contributed to campaigns are automatically deposited into DeFi yield-generating protocols (Aave), earning interest while the campaign is active. The platform takes a configurable fee from successful campaigns, while preserving security and transparency through a robust access control system.

## Key Features

- **Create time-bound fundraising campaigns** with specific fundraising goals
- **Automatic DeFi integration** to generate yield on contributed funds
- **Multiple token support** with configurable minimum contribution amounts
- **Fee sharing system** between platform and campaign creators
- **Role-based access control** with platform admin privileges
- **Refund functionality** for unsuccessful campaigns

## Core Components

### Campaign Management

- **Campaign Contract**: Individual fundraising campaign with a specific goal amount, duration, and target token
- **CampaignContractFactory**: Creates new campaign contracts and maintains a registry of all deployed campaigns

### Financial Infrastructure

- **DefiIntegrationManager**: Manages interactions with Aave for yield generation
- **FeeManager**: Handles fee calculations and distribution between platform and creators
- **TokenRegistry**: Maintains a list of supported tokens with their configurations

### Access Control

- **PlatformAdmin**: Manages administrative access across the platform
- **PlatformAdminAccessControl**: Abstract contract that provides admin-only functions

## Contract Interactions

1. Campaign creators deploy a new campaign through the CampaignContractFactory
2. Contributors send supported tokens to the campaign
3. Funds are automatically deposited into Aave through the DefiIntegrationManager
4. After the campaign ends:
   - If successful (goal reached): Campaign creator can claim funds
   - If unsuccessful: Contributors can request refunds
5. Platform takes a configurable percentage fee from all funds processed

## Technical Details

### Campaign Lifecycle

1. **Creation**: Campaign is deployed with a specific token, goal amount, and duration
2. **Active Phase**: Contributors can send tokens to the campaign
3. **Completion**:
   - Success: Goal amount reached, funds (plus yield) go to creator minus platform fees
   - Failure: Goal not reached, contributors can claim refunds

### DeFi Integration

- Funds are automatically deposited into Aave to generate yield while the campaign is active
- The DefiIntegrationManager handles all interactions with external DeFi protocols
- Yield is split between platform and campaign stakeholders based on campaign outcome

### Fee Structure

- Platform takes a configurable fee (default 10%, maximum 50%)
- Fees are calculated and distributed by the FeeManager contract
- Treasury address can be updated by platform administrators

### Token Support

- Multiple ERC20 tokens can be supported
- Each token has configurable minimum contribution amounts
- Platform administrators can add/remove tokens or update their settings

### Security Features

- Role-based access control with dedicated admin roles
- Emergency pause functionality for critical operations
- Reentrancy protection on all fund-moving functions
- Extensive input validation and error handling
- Standardized error codes and events for better monitoring

## Administrative Functions

Platform administrators can:

- Add or remove supported tokens
- Update fee structure parameters
- Configure minimum contribution amounts
- Override campaign settings in emergency situations
- Update integration with external DeFi protocols
- Pause and unpause critical platform functionality

## Getting Started

To deploy this platform:

1. Deploy the PlatformAdmin contract first
2. Deploy the TokenRegistry contract
3. Deploy the FeeManager contract
4. Deploy the DefiIntegrationManager contract with connections to Aave
5. Deploy the CampaignContractFactory
6. Configure supported tokens in the TokenRegistry

## Error Handling

The platform uses a standardized error code system across all contracts for consistency:

- Error codes are represented as uint8 constants
- Each error comes with relevant context (addresses, amounts) for debugging
- Events are emitted for all significant state changes

---

## Technical Architecture

```
User -> CampaignContractFactory -> Campaign -> DefiIntegrationManager -> Aave
                                    |
                                    v
                          TokenRegistry & FeeManager
                                    |
                                    v
                              PlatformAdmin
```

All components are governed by the PlatformAdmin contract that manages administrative access across the system.

## Contract Dependencies

Understanding the dependencies between contracts is essential for proper deployment:

1. **PlatformAdmin**

   - No dependencies (should be deployed first)

2. **FeeManager**

   - Depends on PlatformAdmin

3. **TokenRegistry**

   - Depends on PlatformAdmin

4. **DefiIntegrationManager**

   - Depends on PlatformAdmin
   - Depends on TokenRegistry
   - Depends on FeeManager
   - Depends on Aave Pool (external)

5. **CampaignContractFactory**

   - Depends on DefiIntegrationManager
   - Depends on PlatformAdmin

6. **Campaign**
   - Depends on DefiIntegrationManager
   - Depends on PlatformAdmin
   - Created by CampaignContractFactory

This dependency chain informs the correct deployment order. For example, you must deploy PlatformAdmin before FeeManager, and DefiIntegrationManager needs both TokenRegistry and FeeManager to be deployed first.

7. **PausableControl**
   - Depends on PlatformAdmin
   - Used by other core contracts to implement emergency pause functionality

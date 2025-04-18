import * as React from 'react'
import Box from '@mui/material/Box'
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import StepContent from '@mui/material/StepContent'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { styled } from '@mui/material/styles'

const CustomStepIcon = styled('div')(({ theme }) => ({
  width: 32,
  height: 32,
  borderRadius: '50%',
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 600
}))

const StepNumber = React.forwardRef<HTMLDivElement>((props, ref) => {
  const { active, completed, icon } = props as any
  return (
    <CustomStepIcon ref={ref}>
      {icon}
    </CustomStepIcon>
  )
})

StepNumber.displayName = 'StepNumber'

const steps = [
  {
    label: 'Contribute to Campaigns',
    description:
      "Choose a campaign and contribute using the campaign's designated token. Your contribution is securely tracked on-chain, and you're registered as an official contributor."
  },
  {
    label: 'Automatic Yield Generation',
    description:
      'Your contributions are automatically deployed to established yield protocols, meaning every contribution generates yield while the campaign is active.'
  },
  {
    label: 'Campaign Completion - Goal Reached',
    description:
      'If the funding goal is reached, the campaign owner can claim all funds plus generated yield. A portion of the yield will be sent to the platform treasury and the owner is free to keep the rest.'
  },
  {
    label: 'Campaign Completion - Goal Not Reached',
    description:
      'If the deadline passes without reaching the goal, contributors can request refunds of their original contributions. Some generated yield will still be sent to the platform treasury, but never at the expense of refund requests.'
  }
]

export default function HowItWorks() {
  const [activeStep, setActiveStep] = React.useState(0)

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1)
  }

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1)
  }

  const handleReset = () => {
    setActiveStep(0)
  }

  return (
    <section className='py-16 bg-gradient-to-b from-blue-50 to-white'>
      <div className='container mx-auto px-4'>
        <div className='max-w-3xl mx-auto text-center mb-12'>
          <h2 className='text-3xl font-bold mb-4'>How It Works</h2>
          <p className='text-xl text-gray-600'>
            Our innovative yield-generation feature ensures your contribution
            has a lasting impact
          </p>
        </div>

        <div className='max-w-2xl mx-auto'>
          <Box sx={{ maxWidth: 400, margin: 'auto' }}>
            <Stepper activeStep={activeStep} orientation="vertical">
              {steps.map((step, index) => (
                <Step key={step.label}>
                  <StepLabel
                    slots={{
                      stepIcon: StepNumber
                    }}
                    optional={
                      index === steps.length - 1 ? (
                        <Typography variant="caption">Last step</Typography>
                      ) : null
                    }
                  >
                    {step.label}
                  </StepLabel>
                  <StepContent>
                    <Typography>{step.description}</Typography>
                    <Box sx={{ mb: 2 }}>
                      {index < steps.length - 1 && (
                        <Button
                          variant="contained"
                          onClick={handleNext}
                          sx={{ mt: 1, mr: 1 }}
                        >
                          Continue
                        </Button>
                      )}
                      {index > 0 && (
                        <Button
                          onClick={handleBack}
                          sx={{ mt: 1, mr: 1 }}
                        >
                          Back
                        </Button>
                      )}
                    </Box>
                  </StepContent>
                </Step>
              ))}
            </Stepper>
            {/* {activeStep === steps.length && (
              <Paper square elevation={0} sx={{ p: 3 }}>
                <Typography>All steps completed - you&apos;re finished</Typography>
                <Button onClick={handleReset} sx={{ mt: 1, mr: 1 }}>
                  Reset
                </Button>
              </Paper>
            )} */}
          </Box>

          <div className='mt-12 bg-blue-50 rounded-lg p-6'>
            <h3 className='text-xl font-semibold mb-4 text-center'>
              Why Yield Generation Matters
            </h3>
            <p className='text-gray-600 mb-4'>
              Traditional donations are one-time contributions. Our platform
              leverages DeFi protocols to generate continuous yields from your
              initial contribution, creating a sustainable source of funding for
              the causes you care about.
            </p>
            <p className='text-gray-600'>
              Your contribution remains intact while the generated yields provide
              ongoing support, maximizing the impact of your donation over time.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

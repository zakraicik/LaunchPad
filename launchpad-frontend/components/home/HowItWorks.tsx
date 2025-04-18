import * as React from 'react'
import Box from '@mui/material/Box'
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import StepContent from '@mui/material/StepContent'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'

const steps = [
  {
    label: 'Contribute to Campaigns',
    description:
      'Choose a campaign you want to support and contribute funds using the campaign token'
  },
  {
    label: 'Automatic Yield Generation',
    description:
      'Your contribution is automatically deployed to a yield-generating protocol'
  },
  {
    label: 'Transparent Tracking',
    description:
      'Accumulated yield covers platform fees, meaning your donation keeps working to support the cause'
  },
  {
    label: 'Sustainable Impact',
    description:
      'Your initial contribution remains intact while generated yields provide ongoing support to the campaign'
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
                      <Button
                        variant="contained"
                        onClick={handleNext}
                        sx={{ mt: 1, mr: 1 }}
                      >
                        {index === steps.length - 1 ? 'Finish' : 'Continue'}
                      </Button>
                      <Button
                        disabled={index === 0}
                        onClick={handleBack}
                        sx={{ mt: 1, mr: 1 }}
                      >
                        Back
                      </Button>
                    </Box>
                  </StepContent>
                </Step>
              ))}
            </Stepper>
            {activeStep === steps.length && (
              <Paper square elevation={0} sx={{ p: 3 }}>
                <Typography>All steps completed - you&apos;re finished</Typography>
                <Button onClick={handleReset} sx={{ mt: 1, mr: 1 }}>
                  Reset
                </Button>
              </Paper>
            )}
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

import * as React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { styled } from "@mui/material/styles";
import SecurityIcon from "@mui/icons-material/Security";
import SavingsIcon from "@mui/icons-material/Savings";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import ShieldIcon from "@mui/icons-material/Shield";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";

const GridContainer = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: theme.spacing(4),
  width: "100%",
  maxWidth: "1200px",
  margin: "0 auto",
}));

const values = [
  {
    icon: <SecurityIcon className="w-8 h-8 text-blue-600" />,
    title: "Blockchain-Powered Transparency",
    description:
      "Smart contracts create immutable records of every transaction, enabling real-time verification of fund movement.",
    detailedDescription:
      "Our platform eliminates traditional intermediaries through blockchain technology. Unlike conventional crowdfunding where third parties control fund distribution, our smart contracts create immutable records of every transaction. Contributors can verify exactly where their money goes in real-time, while campaign creators receive funds directly when goals are met—creating unprecedented transparency and trust.",
  },
  {
    icon: <SavingsIcon className="w-8 h-8 text-blue-600" />,
    title: "Yield-Integrated Funding",
    description:
      "Automatic yield generation from DeFi protocols while fundraising is active, reducing or eliminating platform fees.",
    detailedDescription:
      "Say goodbye to fixed platform fees. Our innovative yield integration automatically invests campaign funds into secure DeFi protocols while fundraising is active. The earlier and larger the contributions, the more yield generated—potentially reducing or even eliminating platform fees entirely. This means more of every dollar goes directly to the projects you care about.",
  },
  {
    icon: <VerifiedUserIcon className="w-8 h-8 text-blue-600" />,
    title: "Built-in Protection",
    description:
      "Automatic refund capabilities if funding goals are not met, ensuring contributor safety and creator accountability.",
    detailedDescription:
      "We've built contributor protection directly into our platform's DNA. If a campaign fails to reach its funding goal, our smart contracts automatically enable refund requests—ensuring your contribution never gets stranded in an underfunded project. This creates a safer environment for backers and incentivizes creators to set realistic, achievable goals.",
  },
  {
    icon: <ShieldIcon className="w-8 h-8 text-blue-600" />,
    title: "Comprehensive Safeguards",
    description:
      "Multiple security features including administrator oversight and emergency pause functions for maximum protection.",
    detailedDescription:
      "Our platform incorporates multiple safeguards including administrator oversight capabilities for exceptional circumstances, a pause function for emergency situations, and systematic status updates. These features create a balanced ecosystem that protects both creators and contributors throughout the fundraising process.",
  },
];

export default function HowItWorks() {
  const [selectedValue, setSelectedValue] = React.useState<number | null>(null);

  const handleOpenModal = (index: number) => {
    setSelectedValue(index);
  };

  const handleCloseModal = () => {
    setSelectedValue(null);
  };

  return (
    <section className="py-16 bg-white/0">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Our Value Propositions</h2>
          <p className="text-xl text-gray-600">
            Discover how we're revolutionizing crowdfunding through blockchain
            technology
          </p>
        </div>

        <GridContainer>
          {values.map((value, index) => (
            <div
              key={index}
              onClick={() => handleOpenModal(index)}
              className="p-4 rounded-lg bg-blue-50 border border-gray-100 transition-all duration-300 hover:scale-105 hover:shadow-md h-full flex flex-col cursor-pointer"
            >
              <div className="flex flex-col items-center text-center flex-grow">
                {value.icon}
                <h3 className="text-lg font-semibold mb-1 text-gray-900 mt-3">
                  {value.title}
                </h3>
                <p className="text-sm text-gray-600">{value.description}</p>
              </div>
            </div>
          ))}
        </GridContainer>

        <Dialog
          open={selectedValue !== null}
          onClose={handleCloseModal}
          maxWidth="sm"
          fullWidth
        >
          {selectedValue !== null && (
            <>
              <DialogTitle className="flex justify-between items-center pr-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 text-blue-600">
                    {values[selectedValue].icon}
                  </div>
                  {values[selectedValue].title}
                </div>
                <IconButton
                  edge="end"
                  color="inherit"
                  onClick={handleCloseModal}
                  aria-label="close"
                >
                  <CloseIcon />
                </IconButton>
              </DialogTitle>
              <DialogContent dividers>
                <Typography>
                  {values[selectedValue].detailedDescription}
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button onClick={handleCloseModal} color="primary">
                  Close
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>
      </div>
    </section>
  );
}

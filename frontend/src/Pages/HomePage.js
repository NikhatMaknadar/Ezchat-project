import React from "react";
import { Box, Container, Heading, Text, Tab, TabList, TabPanel, TabPanels, Tabs } from "@chakra-ui/react";
import Login from "../components/Authentication/Login";
import Signup from "../components/Authentication/Signup";

const HomePage = () => (
  <Box className="auth-page">
    <Container maxW="md">
      <Box className="auth-card">
        <Text className="brand-mark">Talk-A-Tive</Text>
        <Heading size="lg" mb={2}>Private conversations, beautifully simple.</Heading>
        <Text color="gray.500" mb={7}>Connect with people and chat in real time.</Text>
        <Tabs variant="soft-rounded" colorScheme="teal">
          <TabList mb="1.5em">
            <Tab width="50%">Login</Tab>
            <Tab width="50%">Sign Up</Tab>
          </TabList>
          <TabPanels>
            <TabPanel px={1}><Login /></TabPanel>
            <TabPanel px={1}><Signup /></TabPanel>
          </TabPanels>
        </Tabs>
      </Box>
    </Container>
  </Box>
);

export default HomePage;

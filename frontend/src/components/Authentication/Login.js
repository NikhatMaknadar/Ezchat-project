import React, { useState } from "react";
import {
  Button, FormControl, FormLabel, Input, InputGroup, InputRightElement,
  VStack, useToast,
} from "@chakra-ui/react";
import axios from "axios";
import { useHistory } from "react-router-dom";

const Login = () => {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const history = useHistory();

  const submitHandler = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast({ title: "Please fill all fields", status: "warning", duration: 3000, isClosable: true });
      return;
    }

    try {
      setLoading(true);
      const { data } = await axios.post("/api/user/login", {
        email: email.trim(),
        password,
      });
      localStorage.setItem("userInfo", JSON.stringify(data));
      toast({ title: "Login successful", status: "success", duration: 2000, isClosable: true });
      history.replace("/chats");
    } catch (error) {
      toast({
        title: "Login failed",
        description: error.response?.data?.message || "Unable to login",
        status: "error",
        duration: 3500,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submitHandler}>
      <VStack spacing="16px">
        <FormControl isRequired>
          <FormLabel>Email Address</FormLabel>
          <Input value={email} type="email" placeholder="you@example.com"
            onChange={(e) => setEmail(e.target.value)} />
        </FormControl>

        <FormControl isRequired>
          <FormLabel>Password</FormLabel>
          <InputGroup>
            <Input value={password} type={show ? "text" : "password"}
              placeholder="Enter password" onChange={(e) => setPassword(e.target.value)} />
            <InputRightElement width="4.5rem">
              <Button size="sm" variant="ghost" onClick={() => setShow(!show)}>
                {show ? "Hide" : "Show"}
              </Button>
            </InputRightElement>
          </InputGroup>
        </FormControl>

        <Button type="submit" colorScheme="teal" width="100%" isLoading={loading}>
          Login
        </Button>
      </VStack>
    </form>
  );
};

export default Login;

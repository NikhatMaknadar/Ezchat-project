import React, { useState } from "react";
import {
  Button, FormControl, FormLabel, Input, InputGroup, InputRightElement,
  VStack, useToast,
} from "@chakra-ui/react";
import axios from "axios";
import { useHistory } from "react-router-dom";

const Signup = () => {
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [password, setPassword] = useState("");
  const [pic, setPic] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const history = useHistory();

  const postDetails = (file) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({ title: "Use JPG, PNG or WEBP", status: "warning", duration: 3000, isClosable: true });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Image must be smaller than 2 MB", status: "warning", duration: 3000, isClosable: true });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setPic(reader.result);
    reader.readAsDataURL(file);
  };

  const submitHandler = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      toast({ title: "Please fill all fields", status: "warning", duration: 3000, isClosable: true });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", status: "warning", duration: 3000, isClosable: true });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", status: "warning", duration: 3000, isClosable: true });
      return;
    }

    try {
      setLoading(true);
      const { data } = await axios.post("/api/user", {
        name: name.trim(),
        email: email.trim(),
        password,
        pic,
      });
      localStorage.setItem("userInfo", JSON.stringify(data));
      toast({ title: "Account created", status: "success", duration: 2000, isClosable: true });
      history.replace("/chats");
    } catch (error) {
      toast({
        title: "Registration failed",
        description: error.response?.data?.message || "Unable to register",
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
      <VStack spacing="14px">
        <FormControl isRequired><FormLabel>Name</FormLabel>
          <Input placeholder="Your name" onChange={(e) => setName(e.target.value)} />
        </FormControl>
        <FormControl isRequired><FormLabel>Email</FormLabel>
          <Input type="email" placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} />
        </FormControl>
        <FormControl isRequired><FormLabel>Password</FormLabel>
          <InputGroup><Input type={show ? "text" : "password"} placeholder="At least 6 characters"
            onChange={(e) => setPassword(e.target.value)} />
            <InputRightElement width="4.5rem"><Button size="sm" variant="ghost" onClick={() => setShow(!show)}>
              {show ? "Hide" : "Show"}
            </Button></InputRightElement>
          </InputGroup>
        </FormControl>
        <FormControl isRequired><FormLabel>Confirm Password</FormLabel>
          <Input type={show ? "text" : "password"} placeholder="Repeat password"
            onChange={(e) => setConfirmPassword(e.target.value)} />
        </FormControl>
        <FormControl><FormLabel>Profile picture</FormLabel>
          <Input type="file" p={1.5} accept="image/png,image/jpeg,image/webp"
            onChange={(e) => postDetails(e.target.files?.[0])} />
        </FormControl>
        <Button type="submit" colorScheme="teal" width="100%" isLoading={loading}>Create account</Button>
      </VStack>
    </form>
  );
};

export default Signup;

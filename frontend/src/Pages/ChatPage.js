import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import { io } from "socket.io-client";

import {
  Avatar,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Text,
  VStack,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { SearchIcon, SettingsIcon, ArrowBackIcon } from "@chakra-ui/icons";

import { useHistory } from "react-router-dom";
import { authConfig, getUserInfo } from "../api";

const socketUrl = "http://localhost:5000";

/* =========================================================
   HELPERS
   ========================================================= */

const formatTime = (date) => {
  if (!date) return "";

  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatLastSeen = (user) => {
  if (!user) return "";

  if (user.isOnline) {
    return "online";
  }

  if (!user.lastSeen) {
    return "offline";
  }

  return `last seen ${new Date(user.lastSeen).toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const otherUser = (chat, me) => {
  if (!chat || !me) return null;

  return (
    chat.users?.find((u) => String(u._id) !== String(me._id)) || chat.users?.[0]
  );
};
const GroupAvatar = ({ size = "sm", src, name = "Group" }) => (
  <Avatar
    size={size}
    src={src || undefined}
    name={name}
    bg="teal.500"
    color="white"
  />
);

/* =========================================================
   MESSAGE BUBBLE
   ========================================================= */

const MessageBubble = ({ message, mine }) => {
  const senderId = message.sender?._id || message.sender;

  const deliveredTo = message.deliveredTo || [];
  const readBy = message.readBy || [];

  /*
    The sender is already inside deliveredTo/readBy.

    Therefore we check whether another user is present.

    ✓  = sent
    ✓✓ = delivered
    ✓✓ = read
  */

  const hasOtherDelivered = deliveredTo.some(
    (id) => String(id?._id || id) !== String(senderId),
  );

  const hasOtherRead = readBy.some(
    (id) => String(id?._id || id) !== String(senderId),
  );

  return (
    <Flex
      className={`message-row ${mine ? "mine" : "theirs"}`}
      justify={mine ? "flex-end" : "flex-start"}
      mb={2}
    >
      {!mine && (
        <Avatar
          size="xs"
          src={message.sender?.pic}
          name={message.sender?.name}
          mr={2}
        />
      )}

      <Box className={`message-bubble ${mine ? "mine" : "theirs"}`}>
        {/* Only message text. No opposite-user name. */}
        <Text>{message.content}</Text>

        <HStack justify="flex-end" spacing={1} mt={1}>
          <Text className="message-time">{formatTime(message.createdAt)}</Text>

          {mine && (
            <>
              {/* SENT */}
              {!hasOtherDelivered && !hasOtherRead && (
                <Text className="ticks sent">✓</Text>
              )}

              {/* DELIVERED */}
              {hasOtherDelivered && !hasOtherRead && (
                <Text className="ticks delivered">✓✓</Text>
              )}

              {/* READ */}
              {hasOtherRead && <Text className="ticks read">✓✓</Text>}
            </>
          )}
        </HStack>
      </Box>
    </Flex>
  );
};

/* =========================================================
   CHAT PAGE
   ========================================================= */

const ChatPage = () => {
  const history = useHistory();
  const toast = useToast();

  const user = getUserInfo();

  const [chats, setChats] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);

  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const [text, setText] = useState("");

  const [typing, setTyping] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);

  const {
    isOpen: groupOpen,
    onOpen: openGroup,
    onClose: closeGroup,
  } = useDisclosure();

  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState([]);

  // Group profile picture
  const [groupPic, setGroupPic] = useState("");

  const [online, setOnline] = useState({});
  const {
    isOpen: profileOpen,
    onOpen: openProfile,
    onClose: closeProfile,
  } = useDisclosure();

  const [profileName, setProfileName] = useState(user?.name || "");

  const [profileEmail, setProfileEmail] = useState(user?.email || "");

  const [profilePic, setProfilePic] = useState(user?.pic || "");
  const {
    isOpen: groupInfoOpen,
    onOpen: openGroupInfo,
    onClose: closeGroupInfo,
  } = useDisclosure();

  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const typingTimer = useRef(null);

  const selectedChatRef = useRef(null);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  /* =========================================================
     SOCKET CONNECTION
     ========================================================= */

  useEffect(() => {
    if (!user?.token) {
      history.replace("/");
      return;
    }

    const socket = io(socketUrl, {
      auth: {
        token: user.token,
      },
    });

    socketRef.current = socket;

    socket.on("connect_error", () => {
      toast({
        title: "Realtime connection unavailable",
        description: "Messages still work through the API.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
    });

    /* =====================================================
       ONLINE / OFFLINE
       ===================================================== */

    socket.on("presence", ({ userId, isOnline, lastSeen }) => {
      setOnline((prev) => ({
        ...prev,
        [userId]: {
          isOnline,
          lastSeen,
        },
      }));

      setChats((prev) =>
        prev.map((chat) => ({
          ...chat,
          users: chat.users?.map((u) =>
            String(u._id) === String(userId)
              ? {
                  ...u,
                  isOnline,
                  lastSeen,
                }
              : u,
          ),
        })),
      );

      setSelectedChat((prev) =>
        prev
          ? {
              ...prev,
              users: prev.users?.map((u) =>
                String(u._id) === String(userId)
                  ? {
                      ...u,
                      isOnline,
                      lastSeen,
                    }
                  : u,
              ),
            }
          : prev,
      );
    });

    /* =====================================================
       TYPING
       ===================================================== */

    socket.on("typing", ({ userId }) => {
      if (
        selectedChatRef.current?.users?.some(
          (u) => String(u._id) === String(userId),
        )
      ) {
        setRemoteTyping(true);
      }
    });

    socket.on("stop typing", ({ userId }) => {
      if (
        selectedChatRef.current?.users?.some(
          (u) => String(u._id) === String(userId),
        )
      ) {
        setRemoteTyping(false);
      }
    });

    /* =====================================================
       MESSAGE DELIVERED
       ===================================================== */

    socket.on("message delivered", ({ messageId, userId }) => {
      setMessages((prev) =>
        prev.map((message) => {
          if (String(message._id) !== String(messageId)) {
            return message;
          }

          return {
            ...message,
            deliveredTo: Array.from(
              new Set([...(message.deliveredTo || []), userId]),
            ),
          };
        }),
      );
    });

    /* =====================================================
       MESSAGE READ
       ===================================================== */

    socket.on("messages read", ({ chatId, userId }) => {
      if (String(selectedChatRef.current?._id) !== String(chatId)) {
        return;
      }

      setMessages((prev) =>
        prev.map((message) => {
          if (String(message.sender?._id) !== String(user._id)) {
            return message;
          }

          return {
            ...message,
            readBy: Array.from(new Set([...(message.readBy || []), userId])),
            deliveredTo: Array.from(
              new Set([...(message.deliveredTo || []), userId]),
            ),
          };
        }),
      );
    });

    /* =====================================================
       MESSAGE RECEIVED
       ===================================================== */

    socket.on("message received", async (message) => {
      const chatId = message.chat?._id || message.chat;

      const isCurrentChat =
        String(selectedChatRef.current?._id) === String(chatId);

      const senderId = message.sender?._id || message.sender;

      const isMyMessage = String(senderId) === String(user._id);

      // Update latest message in sidebar
      setChats((prev) =>
        prev
          .map((chat) =>
            String(chat._id) === String(chatId)
              ? {
                  ...chat,
                  latestMessage: message,
                  updatedAt: message.createdAt,
                }
              : chat,
          )
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
      );

      /*
       * Message is from another user and
       * that conversation is NOT open.
       */
      if (!isMyMessage && !isCurrentChat) {
        setUnreadCounts((prev) => ({
          ...prev,
          [chatId]: (prev[chatId] || 0) + 1,
        }));
      }

      /*
       * Conversation is currently open.
       */
      if (isCurrentChat) {
        setMessages((prev) =>
          prev.some((m) => String(m._id) === String(message._id))
            ? prev
            : [...prev, message],
        );

        // Clear notification
        setUnreadCounts((prev) => ({
          ...prev,
          [chatId]: 0,
        }));

        /*
         * Automatically mark the message read
         * because the conversation is open.
         */
        if (!isMyMessage) {
          try {
            await axios.post(
              `/api/chat/messages/${chatId}/read`,
              {},
              authConfig(),
            );
          } catch (error) {
            console.error("Failed to mark message read:", error);
          }
        }

        setTimeout(() => {
          socket.emit("stop typing", chatId);
        }, 50);
      }

      /*
       * Mark incoming message as delivered.
       */
      if (
        message.sender?._id &&
        String(message.sender._id) !== String(user._id)
      ) {
        try {
          await axios.post(
            `/api/chat/messages/${message._id}/delivered`,
            {},
            authConfig(),
          );
        } catch (error) {
          console.error("Failed to mark message delivered:", error);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [history, toast, user?.token, user?._id]);

  /* =========================================================
     FETCH CHATS
     ========================================================= */

  const fetchChats = useCallback(async () => {
    try {
      setLoadingChats(true);

      const { data } = await axios.get("/api/chat", authConfig());

      setChats(data);

      const counts = {};

      data.forEach((chat) => {
        counts[chat._id] = chat.unreadCount || 0;
      });

      setUnreadCounts(counts);
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem("userInfo");

        history.replace("/");
      } else {
        toast({
          title: "Unable to load chats",
          description: error.response?.data?.message || "Server error",
          status: "error",
          duration: 3500,
          isClosable: true,
        });
      }
    } finally {
      setLoadingChats(false);
    }
  }, [history, toast]);
  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  /* =========================================================
     LOAD MESSAGES
     ========================================================= */

  useEffect(() => {
    const load = async () => {
      if (!selectedChat) return;

      setLoadingMessages(true);
      setRemoteTyping(false);

      try {
        const { data } = await axios.get(
          `/api/chat/messages/${selectedChat._id}`,
          authConfig(),
        );

        setMessages(data);

        /*
          Mark messages as read when chat opens.
        */

        await axios.post(
          `/api/chat/messages/${selectedChat._id}/read`,
          {},
          authConfig(),
        );
        setUnreadCounts((prev) => ({
          ...prev,
          [selectedChat._id]: 0,
        }));

        socketRef.current?.emit("join chat", selectedChat._id);
      } catch (error) {
        toast({
          title: "Unable to load messages",
          description: error.response?.data?.message || "Server error",
          status: "error",
          duration: 3500,
          isClosable: true,
        });
      } finally {
        setLoadingMessages(false);
      }
    };

    load();

    return () => {
      if (selectedChat) {
        socketRef.current?.emit("leave chat", selectedChat._id);
      }
    };
  }, [selectedChat, toast]);

  /* =========================================================
     AUTO SCROLL
     ========================================================= */

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, remoteTyping]);

  /* =========================================================
     USER SEARCH
     ========================================================= */

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!search.trim()) {
        /*
            Don't clear group users while the
            group modal is open.
          */

        if (!groupOpen) {
          setResults([]);
        }

        return;
      }

      try {
        const { data } = await axios.get(
          `/api/user?search=${encodeURIComponent(search.trim())}`,
          authConfig(),
        );

        setResults(data);
      } catch (error) {
        toast({
          title: "Search failed",
          description: error.response?.data?.message || "Server error",
          status: "error",
          duration: 2500,
          isClosable: true,
        });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, toast, groupOpen]);

  /* =========================================================
     SELECT USER
     ========================================================= */

  const selectUser = async (person) => {
    try {
      const { data } = await axios.post(
        "/api/chat",
        {
          userId: person._id,
        },
        authConfig(),
      );

      setChats((prev) => [
        data,
        ...prev.filter((chat) => chat._id !== data._id),
      ]);

      setSelectedChat(data);
      setSearch("");
      setResults([]);
    } catch (error) {
      toast({
        title: "Could not open chat",
        description: error.response?.data?.message || "Server error",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  /* =========================================================
     LOAD GROUP MEMBERS
     ========================================================= */

  const loadGroupMembers = async () => {
    try {
      const { data } = await axios.get("/api/user", authConfig());

      setResults(data);
    } catch (error) {
      toast({
        title: "Unable to load users",
        description: error.response?.data?.message || "Could not load users",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  /* =========================================================
     TOGGLE GROUP MEMBER
     ========================================================= */

  const toggleGroupMember = (person) => {
    setGroupMembers((prev) =>
      prev.some((p) => p._id === person._id)
        ? prev.filter((p) => p._id !== person._id)
        : [...prev, person],
    );
  };

  /* =========================================================
     CREATE GROUP
     ========================================================= */

  const createGroup = async () => {
    if (!groupName.trim() || !groupMembers.length) {
      toast({
        title: "Add a group name and at least one member",
        status: "warning",
        duration: 2500,
        isClosable: true,
      });

      return;
    }

    try {
      const { data } = await axios.post(
        "/api/chat/group",
        {
          name: groupName.trim(),
          userIds: groupMembers.map((p) => p._id),
          groupPic: groupPic || "",
        },
        authConfig(),
      );

      setChats((prev) => [
        data,
        ...prev.filter((chat) => chat._id !== data._id),
      ]);

      setSelectedChat(data);

      setGroupName("");
      setGroupMembers([]);
      setGroupPic("");
      setResults([]);
      setSearch("");

      closeGroup();
    } catch (error) {
      toast({
        title: "Could not create group",
        description: error.response?.data?.message || "Server error",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  /* =========================================================
     SEND MESSAGE
     ========================================================= */

  const sendMessage = async (e) => {
    e?.preventDefault();

    const content = text.trim();

    if (!content || !selectedChat || sending) {
      return;
    }

    try {
      setSending(true);
      setText("");

      socketRef.current?.emit("stop typing", selectedChat._id);

      const { data } = await axios.post(
        "/api/chat/messages",
        {
          content,
          chatId: selectedChat._id,
        },
        authConfig(),
      );

      setMessages((prev) =>
        prev.some((message) => message._id === data._id)
          ? prev
          : [...prev, data],
      );

      setChats((prev) =>
        prev
          .map((chat) =>
            chat._id === selectedChat._id
              ? {
                  ...chat,
                  latestMessage: data,
                  updatedAt: data.createdAt,
                }
              : chat,
          )
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
      );
    } catch (error) {
      toast({
        title: "Message not sent",
        description: error.response?.data?.message || "Server error",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setSending(false);
    }
  };

  /* =========================================================
     TYPING
     ========================================================= */

  const onTyping = (value) => {
    setText(value);

    if (!selectedChat || !socketRef.current) {
      return;
    }

    if (!typing) {
      setTyping(true);

      socketRef.current.emit("typing", selectedChat._id);
    }

    clearTimeout(typingTimer.current);

    typingTimer.current = setTimeout(() => {
      setTyping(false);

      socketRef.current?.emit("stop typing", selectedChat._id);
    }, 900);
  };

  const handleProfilePicture = (file) => {
    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast({
        title: "Invalid image",
        description: "Please select a JPG or PNG image.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });

      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Image too large",
        description: "Profile picture must be smaller than 2 MB.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });

      return;
    }

    const reader = new FileReader();

    reader.onloadend = () => {
      setProfilePic(reader.result);
    };

    reader.readAsDataURL(file);
  };
  const handleGroupPicture = (file) => {
    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast({
        title: "Invalid image",
        description: "Please select a JPG or PNG image.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Image too large",
        description: "Group picture must be smaller than 2 MB.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const reader = new FileReader();

    reader.onloadend = () => {
      setGroupPic(reader.result);
    };

    reader.readAsDataURL(file);
  };
  const saveGroupPicture = async () => {
    if (!selectedChat?.isGroupChat) return;

    if (!groupPic) {
      toast({
        title: "Please select a group picture",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      const { data } = await axios.put(
        `/api/chat/${selectedChat._id}/group-picture`,
        {
          groupPic,
        },
        authConfig(),
      );

      // Update currently selected chat
      setSelectedChat(data);

      // Update chat list
      setChats((prev) =>
        prev.map((chat) =>
          String(chat._id) === String(data._id) ? data : chat,
        ),
      );

      toast({
        title: "Group picture updated",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Unable to update group picture",
        description: error.response?.data?.message || "Something went wrong",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    }
  };
  const saveProfile = async () => {
    if (!profileName.trim() || !profileEmail.trim()) {
      toast({
        title: "Please fill all required fields",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });

      return;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        toast({
          title: "Password too short",
          description: "New password must be at least 6 characters.",
          status: "warning",
          duration: 3000,
          isClosable: true,
        });

        return;
      }

      if (newPassword !== confirmNewPassword) {
        toast({
          title: "Passwords do not match",
          status: "warning",
          duration: 3000,
          isClosable: true,
        });

        return;
      }
    }

    try {
      setSavingProfile(true);

      const { data } = await axios.put(
        "/api/user/profile",
        {
          name: profileName.trim(),
          email: profileEmail.trim(),
          pic: profilePic,
          password: newPassword || undefined,
          confirmPassword: newPassword ? confirmNewPassword : undefined,
        },
        authConfig(),
      );

      /*
      Update localStorage with the
      new user information + token.
    */

      localStorage.setItem("userInfo", JSON.stringify(data));

      /*
      Update sidebar user immediately.
      Reloading is not necessary.
    */

      setProfileName(data.name);
      setProfileEmail(data.email);
      setProfilePic(data.pic);

      setNewPassword("");
      setConfirmNewPassword("");

      closeProfile();

      toast({
        title: "Profile updated",
        description: "Your account has been updated successfully.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      /*
      Reload once so getUserInfo()
      receives the new user data everywhere.
    */

      window.location.reload();
    } catch (error) {
      toast({
        title: "Unable to update profile",
        description: error.response?.data?.message || "Something went wrong",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setSavingProfile(false);
    }
  };
  /* =========================================================
     LOGOUT
     ========================================================= */

  const handleLogout = () => {
    localStorage.removeItem("userInfo");

    socketRef.current?.disconnect();

    history.replace("/");
  };

  /* =========================================================
     CURRENT CHAT USER
     ========================================================= */

  const currentOther = useMemo(
    () => otherUser(selectedChat, user),
    [selectedChat, user],
  );

  const status = online[currentOther?._id] || currentOther;

  /* =========================================================
     UI
     ========================================================= */

  return (
    <Box className="chat-app">
      <Flex className="chat-shell">
        {/* =================================================
            SIDEBAR
        ================================================= */}

        <Box className={`sidebar ${selectedChat ? "mobile-hidden" : ""}`}>
          {/* PROFILE */}

          <Flex
            className="sidebar-header"
            align="center"
            justify="space-between"
          >
            <HStack>
              <Avatar size="sm" src={user?.pic} name={user?.name} />

              <Box>
                <Text fontWeight="700">{user?.name}</Text>

                <Text fontSize="xs" color="gray.500">
                  My account
                </Text>
              </Box>
            </HStack>

            <Menu>
              <MenuButton
                as={IconButton}
                icon={<SettingsIcon />}
                variant="ghost"
                aria-label="Menu"
              />

              <MenuList>
                <MenuItem
                  onClick={() => {
                    setProfileName(user?.name || "");
                    setProfileEmail(user?.email || "");
                    setProfilePic(user?.pic || "");
                    setNewPassword("");
                    setConfirmNewPassword("");
                    openProfile();
                  }}
                >
                  Edit Profile
                </MenuItem>

                <MenuItem onClick={handleLogout}>Logout</MenuItem>
              </MenuList>
            </Menu>
          </Flex>

          {/* SEARCH */}

          <Box p={3} borderBottom="1px solid" borderColor="gray.100">
            <Box className="search-box">
              <SearchIcon color="gray.400" mr={2} />

              <Input
                variant="unstyled"
                placeholder="Search people..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Box>

            {search && !groupOpen && (
              <Box className="search-results">
                {results.length ? (
                  results.map((person) => (
                    <HStack
                      key={person._id}
                      className="search-person"
                      onClick={() => selectUser(person)}
                    >
                      <Avatar size="sm" src={person.pic} name={person.name} />

                      <Box>
                        <Text fontWeight="600">{person.name}</Text>

                        <Text fontSize="xs" color="gray.500">
                          {person.email}
                        </Text>
                      </Box>

                      {person.isOnline && (
                        <Badge ml="auto" colorScheme="green">
                          online
                        </Badge>
                      )}
                    </HStack>
                  ))
                ) : (
                  <Text p={3} color="gray.500" fontSize="sm">
                    No users found
                  </Text>
                )}
              </Box>
            )}
          </Box>

          {/* CHAT LIST */}

          <Box className="chat-list">
            <Flex px={4} pt={4} pb={2} align="center" justify="space-between">
              <Text
                fontSize="xs"
                fontWeight="800"
                color="gray.500"
                textTransform="uppercase"
              >
                Chats
              </Text>

              <Button
                size="xs"
                variant="ghost"
                colorScheme="teal"
                onClick={() => {
                  setSearch("");
                  setResults([]);
                  setGroupMembers([]);

                  loadGroupMembers();
                  openGroup();
                }}
              >
                New group
              </Button>
            </Flex>

            {loadingChats ? (
              <Flex justify="center" p={8}>
                <Spinner color="teal.400" />
              </Flex>
            ) : chats.length ? (
              chats.map((chat) => {
                const person = otherUser(chat, user);

                return (
                  <HStack
                    key={chat._id}
                    className={`chat-list-item ${
                      selectedChat?._id === chat._id ? "active" : ""
                    }`}
                    onClick={() => {
                      setSelectedChat(chat);

                      setUnreadCounts((prev) => ({
                        ...prev,
                        [chat._id]: 0,
                      }));
                    }}
                  >
                    {chat.isGroupChat ? (
                      <GroupAvatar
                        size="sm"
                        src={chat.groupPic}
                        name={chat.chatName}
                      />
                    ) : (
                      <Avatar src={person?.pic} name={person?.name} />
                    )}

                    <Box minW={0} flex="1">
                      <Flex justify="space-between" align="center">
                        <Text fontWeight="700" noOfLines={1} flex="1">
                          {chat.isGroupChat ? chat.chatName : person?.name}
                        </Text>

                        <VStack spacing={1} align="flex-end" ml={2}>
                          <Text fontSize="xs" color="gray.400">
                            {formatTime(chat.latestMessage?.createdAt)}
                          </Text>

                          {unreadCounts[chat._id] > 0 && (
                            <Flex
                              minW="21px"
                              h="21px"
                              px="6px"
                              borderRadius="full"
                              bg="green.500"
                              color="white"
                              align="center"
                              justify="center"
                              fontSize="11px"
                              fontWeight="bold"
                            >
                              {unreadCounts[chat._id] > 99
                                ? "99+"
                                : unreadCounts[chat._id]}
                            </Flex>
                          )}
                        </VStack>
                      </Flex>

                      <Text fontSize="sm" color="gray.500" noOfLines={1}>
                        {chat.latestMessage
                          ? `${
                              chat.latestMessage.sender?._id === user?._id
                                ? "You: "
                                : ""
                            }${chat.latestMessage.content}`
                          : "No messages yet"}
                      </Text>
                    </Box>
                  </HStack>
                );
              })
            ) : (
              <Text p={6} color="gray.500" textAlign="center">
                No conversations yet. Search a person to start chatting.
              </Text>
            )}
          </Box>
        </Box>

        {/* =================================================
            CONVERSATION
        ================================================= */}

        <Box className={`conversation ${!selectedChat ? "empty" : ""}`}>
          {!selectedChat ? (
            <Flex className="welcome-panel">
              <Box textAlign="center">
                <div className="welcome-icon">💬</div>

                <Text fontSize="2xl" fontWeight="800" mb={2}>
                  Your messages
                </Text>

                <Text color="gray.500">
                  Select a conversation or search for someone to start.
                </Text>
              </Box>
            </Flex>
          ) : (
            <>
              {/* CHAT HEADER */}

              <Flex className="conversation-header" align="center">
                <IconButton
                  className="mobile-back"
                  icon={<ArrowBackIcon />}
                  variant="ghost"
                  aria-label="Back"
                  onClick={() => setSelectedChat(null)}
                />

                {selectedChat.isGroupChat ? (
                  <Box
                    cursor="pointer"
                    onClick={openGroupInfo}
                    title="View group info"
                  >
                    <GroupAvatar
                      size="sm"
                      src={selectedChat.groupPic}
                      name={selectedChat.chatName}
                    />
                  </Box>
                ) : (
                  <Avatar
                    size="sm"
                    src={currentOther?.pic}
                    name={currentOther?.name}
                  />
                )}

                <Box
                  ml={3}
                  cursor={selectedChat.isGroupChat ? "pointer" : "default"}
                  onClick={selectedChat.isGroupChat ? openGroupInfo : undefined}
                >
                  <Text fontWeight="800">
                    {selectedChat.isGroupChat
                      ? selectedChat.chatName
                      : currentOther?.name}
                  </Text>

                  <Text
                    fontSize="xs"
                    color={remoteTyping ? "teal.500" : "gray.500"}
                  >
                    {remoteTyping
                      ? "typing..."
                      : selectedChat.isGroupChat
                        ? "Group chat"
                        : status?.isOnline
                          ? "online"
                          : formatLastSeen(status || currentOther)}
                  </Text>
                </Box>
              </Flex>

              {/* MESSAGES */}

              <Box className="message-area">
                {loadingMessages ? (
                  <Flex justify="center" align="center" h="100%">
                    <Spinner color="teal.400" size="lg" />
                  </Flex>
                ) : messages.length ? (
                  messages.map((message) => (
                    <MessageBubble
                      key={message._id}
                      message={message}
                      mine={String(message.sender?._id) === String(user?._id)}
                    />
                  ))
                ) : (
                  <Flex className="empty-chat">
                    <Text>No messages yet. Say hello 👋</Text>
                  </Flex>
                )}

                {remoteTyping && (
                  <Text className="typing-bubble">
                    {currentOther?.name} is typing…
                  </Text>
                )}

                <div ref={bottomRef} />
              </Box>

              {/* MESSAGE INPUT */}

              <Box className="composer">
                <form onSubmit={sendMessage}>
                  <HStack>
                    <Input
                      value={text}
                      onChange={(e) => onTyping(e.target.value)}
                      placeholder="Type a message..."
                      bg="white"
                    />

                    <Button
                      type="submit"
                      colorScheme="teal"
                      isLoading={sending}
                    >
                      Send
                    </Button>
                  </HStack>
                </form>
              </Box>
            </>
          )}
        </Box>

        {/* =================================================
            GROUP MODAL
        ================================================= */}

        <Modal
          isOpen={groupOpen}
          onClose={() => {
            closeGroup();
            setSearch("");
            setResults([]);
            setGroupMembers([]);
            setGroupName("");
          }}
          isCentered
        >
          <ModalOverlay />

          <ModalContent borderRadius="18px">
            <ModalHeader>Create a group</ModalHeader>

            <ModalCloseButton />

            <ModalBody>
              {/* GROUP NAME */}

              <Input
                mb={4}
                placeholder="Group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />

              <Text fontSize="sm" fontWeight="700" mb={2}>
                Select members
              </Text>

              {/* GROUP MEMBER SEARCH */}

              <Input
                mb={3}
                placeholder="Search members..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {/* SELECTED MEMBERS */}

              {groupMembers.length > 0 && (
                <Box mb={3} p={2} borderRadius="md" bg="gray.50">
                  <Text fontSize="xs" color="gray.500" mb={2}>
                    Selected members
                  </Text>

                  <HStack wrap="wrap" spacing={2}>
                    {groupMembers.map((person) => (
                      <Badge
                        key={person._id}
                        colorScheme="teal"
                        px={2}
                        py={1}
                        borderRadius="full"
                      >
                        {person.name}
                      </Badge>
                    ))}
                  </HStack>
                </Box>
              )}

              {/* MEMBER LIST */}

              <VStack
                align="stretch"
                maxH="300px"
                overflowY="auto"
                divider={<Divider />}
              >
                {results.length ? (
                  results.map((person) => {
                    const selected = groupMembers.some(
                      (p) => String(p._id) === String(person._id),
                    );

                    return (
                      <HStack key={person._id} py={2}>
                        <Checkbox
                          isChecked={selected}
                          onChange={() => toggleGroupMember(person)}
                        >
                          <HStack ml={2}>
                            <Avatar
                              size="sm"
                              src={person.pic}
                              name={person.name}
                            />

                            <Box>
                              <Text fontWeight="600">{person.name}</Text>

                              <Text fontSize="xs" color="gray.500">
                                {person.email}
                              </Text>
                            </Box>
                          </HStack>
                        </Checkbox>
                      </HStack>
                    );
                  })
                ) : (
                  <Text
                    color="gray.500"
                    fontSize="sm"
                    py={4}
                    textAlign="center"
                  >
                    No users found.
                  </Text>
                )}
              </VStack>

              <Text mt={3} fontSize="xs" color="gray.500">
                {groupMembers.length} member(s) selected
              </Text>
            </ModalBody>

            <ModalFooter>
              <Button
                mr={3}
                variant="ghost"
                onClick={() => {
                  closeGroup();
                  setSearch("");
                  setResults([]);
                  setGroupMembers([]);
                  setGroupName("");
                }}
              >
                Cancel
              </Button>

              <Button colorScheme="teal" onClick={createGroup}>
                Create group
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* =================================================
            GROUP INFO MODAL
        ================================================= */}

        <Modal isOpen={groupInfoOpen} onClose={closeGroupInfo} isCentered>
          <ModalOverlay />

          <ModalContent borderRadius="18px">
            <ModalHeader textAlign="center">Group Info</ModalHeader>

            <ModalCloseButton />

            <ModalBody pb={6}>
              {/* GROUP PROFILE PICTURE */}
              {selectedChat?.isGroupChat && (
                <>
                  <VStack spacing={3} mb={6}>
                    {/* GROUP PHOTO */}
                    <Avatar
                      size="xl"
                      src={selectedChat.groupPic || undefined}
                      name={selectedChat.chatName}
                      bg="teal.500"
                    />

                    {/* ADD / CHANGE GROUP PHOTO */}
                    {String(selectedChat.groupAdmin?._id) ===
                      String(user?._id) && (
                      <FormControl>
                        <Input
                          id="group-picture-change"
                          type="file"
                          display="none"
                          accept="image/png,image/jpeg"
                          onChange={(e) =>
                            handleGroupPicture(e.target.files?.[0])
                          }
                        />

                        <HStack>
                          <Button
                            as="label"
                            htmlFor="group-picture-change"
                            size="sm"
                            variant="outline"
                            colorScheme="teal"
                            cursor="pointer"
                          >
                            Choose Photo
                          </Button>

                          <Button
                            size="sm"
                            colorScheme="teal"
                            onClick={saveGroupPicture}
                            isDisabled={!groupPic}
                          >
                            {selectedChat.groupPic
                              ? "Save New Photo"
                              : "Save Photo"}
                          </Button>
                        </HStack>
                      </FormControl>
                    )}

                    {/* GROUP NAME */}
                    <Text fontSize="xl" fontWeight="800" textAlign="center">
                      {selectedChat.chatName}
                    </Text>

                    {/* MEMBER COUNT */}
                    <Text fontSize="sm" color="gray.500">
                      {selectedChat.users?.length || 0} members
                    </Text>
                  </VStack>

                  <Divider mb={4} />

                  <Text fontSize="sm" fontWeight="800" color="gray.500" mb={3}>
                    MEMBERS
                  </Text>

                  <VStack
                    align="stretch"
                    spacing={0}
                    maxH="350px"
                    overflowY="auto"
                  >
                    {selectedChat.users?.map((member) => {
                      const isAdmin =
                        String(selectedChat.groupAdmin?._id) ===
                        String(member._id);

                      const isMe = String(member._id) === String(user?._id);

                      return (
                        <HStack
                          key={member._id}
                          py={3}
                          px={2}
                          borderRadius="md"
                          _hover={{ bg: "gray.50" }}
                        >
                          <Avatar
                            size="sm"
                            src={member.pic}
                            name={member.name}
                          />

                          <Box flex="1" minW={0}>
                            <HStack spacing={2}>
                              <Text fontWeight="600" noOfLines={1}>
                                {member.name}
                              </Text>

                              {isMe && (
                                <Badge colorScheme="teal" fontSize="10px">
                                  You
                                </Badge>
                              )}
                            </HStack>

                            <Text fontSize="xs" color="gray.500" noOfLines={1}>
                              {member.email}
                            </Text>
                          </Box>

                          {isAdmin && (
                            <Badge colorScheme="teal" borderRadius="full">
                              Admin
                            </Badge>
                          )}
                        </HStack>
                      );
                    })}
                  </VStack>
                </>
              )}
            </ModalBody>

            <ModalFooter>
              <Button colorScheme="teal" width="100%" onClick={closeGroupInfo}>
                Close
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* EDIT PROFILE MODAL */}

        <Modal isOpen={profileOpen} onClose={closeProfile} isCentered>
          <ModalOverlay />

          <ModalContent borderRadius="18px">
            <ModalHeader>Edit Profile</ModalHeader>

            <ModalCloseButton />

            <ModalBody>
              <VStack spacing={4}>
                <Avatar size="xl" src={profilePic} name={profileName} />

                <FormControl>
                  <FormLabel>Profile Picture</FormLabel>

                  <Input
                    type="file"
                    p={1.5}
                    accept="image/png,image/jpeg"
                    onChange={(e) => handleProfilePicture(e.target.files?.[0])}
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Name</FormLabel>

                  <Input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Email</FormLabel>

                  <Input
                    type="email"
                    value={profileEmail}
                    isReadOnly
                    bg="gray.100"
                    cursor="not-allowed"
                  />

                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Email address cannot be changed.
                  </Text>
                </FormControl>

                <Divider />

                <Text fontWeight="700" alignSelf="flex-start">
                  Change Password
                </Text>

                <FormControl>
                  <FormLabel>New Password</FormLabel>

                  <InputGroup>
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      placeholder="Leave empty to keep current password"
                      onChange={(e) => setNewPassword(e.target.value)}
                    />

                    <InputRightElement width="4.5rem">
                      <Button
                        h="1.75rem"
                        size="sm"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? "Hide" : "Show"}
                      </Button>
                    </InputRightElement>
                  </InputGroup>
                </FormControl>

                <FormControl>
                  <FormLabel>Confirm New Password</FormLabel>

                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={confirmNewPassword}
                    placeholder="Confirm new password"
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                  />
                </FormControl>
              </VStack>
            </ModalBody>

            <ModalFooter>
              <Button mr={3} variant="ghost" onClick={closeProfile}>
                Cancel
              </Button>

              <Button
                colorScheme="teal"
                onClick={saveProfile}
                isLoading={savingProfile}
              >
                Save Changes
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Flex>
    </Box>
  );
};

export default ChatPage;

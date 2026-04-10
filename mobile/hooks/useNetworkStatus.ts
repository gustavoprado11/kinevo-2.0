import { useState, useEffect } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [wasDisconnected, setWasDisconnected] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const connected = state.isConnected ?? true;
      if (!connected) setWasDisconnected(true);
      setIsConnected(connected);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isConnected && wasDisconnected) {
      const timer = setTimeout(() => setWasDisconnected(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, wasDisconnected]);

  return { isConnected, wasDisconnected };
}

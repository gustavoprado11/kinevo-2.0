import React from "react";
import { View } from "react-native";
import { Skeleton } from "../Skeleton";

export function FormsSkeleton() {
  return (
    <View style={{ flex: 1, paddingTop: 16 }}>
      {/* Title */}
      <View style={{ paddingHorizontal: 20 }}>
        <Skeleton width={160} height={24} borderRadius={6} />
      </View>

      {/* Tab indicator */}
      <View
        style={{
          flexDirection: "row",
          marginHorizontal: 20,
          marginTop: 16,
          marginBottom: 12,
          backgroundColor: "#e2e8f0",
          borderRadius: 10,
          padding: 3,
          gap: 4,
        }}
      >
        <Skeleton
          width="48%"
          height={36}
          borderRadius={8}
          style={{ backgroundColor: "#ffffff" }}
        />
        <Skeleton width="48%" height={36} borderRadius={8} />
      </View>

      {/* Filter chips */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 20,
          marginBottom: 12,
          gap: 8,
        }}
      >
        {[70, 90, 80].map((w, i) => (
          <Skeleton key={i} width={w} height={32} borderRadius={20} />
        ))}
      </View>

      {/* Submission cards */}
      <View style={{ paddingHorizontal: 20 }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton
            key={i}
            width="100%"
            height={80}
            borderRadius={16}
            style={{ marginBottom: 10 }}
          />
        ))}
      </View>
    </View>
  );
}

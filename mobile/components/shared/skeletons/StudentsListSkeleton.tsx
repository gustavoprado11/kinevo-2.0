import React from "react";
import { View } from "react-native";
import { Skeleton } from "../Skeleton";

function StudentCardSkeleton() {
  return (
    <View
      style={{
        backgroundColor: "#ffffff",
        borderRadius: 20,
        padding: 14,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.04)",
      }}
    >
      <Skeleton width={44} height={44} borderRadius={14} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Skeleton width={140} height={16} borderRadius={6} />
        <Skeleton
          width={100}
          height={12}
          borderRadius={4}
          style={{ marginTop: 6 }}
        />
        <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
          <Skeleton width={60} height={20} borderRadius={100} />
          <Skeleton width={70} height={20} borderRadius={100} />
        </View>
      </View>
    </View>
  );
}

export function StudentsListSkeleton() {
  return (
    <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}>
      {/* Title */}
      <Skeleton width={100} height={24} borderRadius={6} />

      {/* Search bar */}
      <Skeleton
        width="100%"
        height={44}
        borderRadius={14}
        style={{ marginTop: 16 }}
      />

      {/* Filter chips */}
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          marginTop: 12,
          marginBottom: 16,
        }}
      >
        {[80, 90, 70, 85].map((w, i) => (
          <Skeleton key={i} width={w} height={32} borderRadius={100} />
        ))}
      </View>

      {/* Student cards */}
      {[0, 1, 2, 3, 4].map((i) => (
        <StudentCardSkeleton key={i} />
      ))}
    </View>
  );
}

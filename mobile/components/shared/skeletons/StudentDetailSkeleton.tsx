import React from "react";
import { View } from "react-native";
import { Skeleton } from "../Skeleton";

export function StudentDetailSkeleton() {
  return (
    <View style={{ flex: 1 }}>
      {/* Header with avatar + info */}
      <View
        style={{
          backgroundColor: "#ffffff",
          paddingBottom: 14,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingTop: 12,
          }}
        >
          {/* Avatar */}
          <Skeleton
            width={56}
            height={56}
            borderRadius={28}
            style={{ marginRight: 14 }}
          />
          {/* Info */}
          <View style={{ flex: 1 }}>
            <Skeleton width={160} height={20} borderRadius={6} />
            <Skeleton
              width={200}
              height={14}
              borderRadius={4}
              style={{ marginTop: 4 }}
            />
            <View
              style={{ flexDirection: "row", gap: 6, marginTop: 6 }}
            >
              <Skeleton width={60} height={22} borderRadius={8} />
              <Skeleton width={70} height={22} borderRadius={8} />
            </View>
          </View>
        </View>
      </View>

      {/* Action buttons */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 20,
          paddingVertical: 14,
          gap: 8,
          backgroundColor: "#ffffff",
        }}
      >
        <Skeleton width={130} height={44} borderRadius={12} />
        <Skeleton width={140} height={44} borderRadius={12} />
        <Skeleton width={120} height={44} borderRadius={12} />
      </View>

      {/* Tab indicator */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#ffffff",
          borderTopWidth: 0.5,
          borderTopColor: "rgba(0,0,0,0.06)",
        }}
      >
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flex: 1, alignItems: "center", paddingVertical: 12 }}>
            <Skeleton width={60} height={14} borderRadius={4} />
          </View>
        ))}
      </View>

      {/* Content area - stat cards grid */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: "#ffffff",
              borderRadius: 20,
              padding: 16,
              height: 120,
            }}
          >
            <Skeleton width={36} height={36} borderRadius={12} />
            <Skeleton
              width={80}
              height={28}
              borderRadius={6}
              style={{ marginTop: 12 }}
            />
            <Skeleton
              width={100}
              height={12}
              borderRadius={4}
              style={{ marginTop: 4 }}
            />
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: "#ffffff",
              borderRadius: 20,
              padding: 16,
              height: 120,
            }}
          >
            <Skeleton width={36} height={36} borderRadius={12} />
            <Skeleton
              width={80}
              height={28}
              borderRadius={6}
              style={{ marginTop: 12 }}
            />
            <Skeleton
              width={100}
              height={12}
              borderRadius={4}
              style={{ marginTop: 4 }}
            />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: "#ffffff",
              borderRadius: 20,
              padding: 16,
              height: 120,
            }}
          >
            <Skeleton width={36} height={36} borderRadius={12} />
            <Skeleton
              width={80}
              height={28}
              borderRadius={6}
              style={{ marginTop: 12 }}
            />
            <Skeleton
              width={100}
              height={12}
              borderRadius={4}
              style={{ marginTop: 4 }}
            />
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: "#ffffff",
              borderRadius: 20,
              padding: 16,
              height: 120,
            }}
          >
            <Skeleton width={36} height={36} borderRadius={12} />
            <Skeleton
              width={80}
              height={28}
              borderRadius={6}
              style={{ marginTop: 12 }}
            />
            <Skeleton
              width={100}
              height={12}
              borderRadius={4}
              style={{ marginTop: 4 }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

import React from "react";
import { View } from "react-native";
import { Skeleton } from "../Skeleton";

export function DashboardSkeleton() {
  return (
    <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}>
      {/* Greeting */}
      <Skeleton width={200} height={24} borderRadius={6} />
      <Skeleton
        width={140}
        height={16}
        borderRadius={6}
        style={{ marginTop: 4 }}
      />

      {/* Sala de Treino button */}
      <Skeleton
        width="100%"
        height={56}
        borderRadius={16}
        style={{ marginTop: 16 }}
      />

      {/* Pending actions section */}
      <Skeleton
        width={120}
        height={11}
        borderRadius={4}
        style={{ marginTop: 20, marginBottom: 10 }}
      />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Skeleton width={200} height={80} borderRadius={16} />
        <Skeleton width={200} height={80} borderRadius={16} />
      </View>

      {/* Stats section label */}
      <Skeleton
        width={100}
        height={11}
        borderRadius={4}
        style={{ marginTop: 20, marginBottom: 10 }}
      />

      {/* Stats grid 2x2 */}
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
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
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

      {/* Activity feed section label */}
      <Skeleton
        width={130}
        height={11}
        borderRadius={4}
        style={{ marginBottom: 10 }}
      />

      {/* Activity feed items */}
      {[0, 1, 2].map((i) => (
        <Skeleton
          key={i}
          width="100%"
          height={64}
          borderRadius={12}
          style={{ marginBottom: 8 }}
        />
      ))}
    </View>
  );
}

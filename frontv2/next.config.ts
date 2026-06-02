import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // next/image-аар Cloudinary URL render хийхэд зөвшөөрөл өгөх
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;

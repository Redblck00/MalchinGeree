'use client';

import React from 'react';

const LoadingSpinner = () => {
  return (
    <div className="min-h-screen bg-[#0d161f] flex items-center justify-center">
      <div className="w-[200px] h-[200px] relative">
        
        <div className="spinner absolute inset-0 border-8 border-[#162534] border-t-[#09f] rounded-full"></div>
        <div className="spinner absolute inset-[8px] border-8 border-[#162534] border-t-[#09f] rounded-full"></div>
        <div className="spinner absolute inset-[16px] border-8 border-[#162534] border-t-[#09f] rounded-full"></div>
        <div className="spinner absolute inset-[24px] border-8 border-[#162534] border-t-[#09f] rounded-full"></div>
        <div className="spinner absolute inset-[32px] border-8 border-[#162534] border-t-[#09f] rounded-full"></div>
        <div className="spinner absolute inset-[40px] border-8 border-[#162534] border-t-[#09f] rounded-full"></div>
        <div className="spinner absolute inset-[48px] border-8 border-[#162534] border-t-[#09f] rounded-full"></div>
      </div>
    </div>
  );
};

export default LoadingSpinner;
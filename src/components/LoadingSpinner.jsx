// src/components/LoadingSpinner.jsx
// 共用的載入動畫元件

import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * 全螢幕載入動畫
 */
export function FullScreenLoader({ message = '載入中...' }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
        <p className="text-gray-600 font-medium">{message}</p>
      </div>
    </div>
  );
}

/**
 * 區塊載入動畫（小尺寸）
 */
export function InlineLoader({ message = '載入中...', size = 'md' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className="flex items-center justify-center gap-2 p-4">
      <Loader2 className={`${sizeClasses[size]} text-blue-600 animate-spin`} />
      <span className="text-gray-600 text-sm">{message}</span>
    </div>
  );
}

/**
 * 按鈕載入動畫
 */
export function ButtonLoader({ children, loading = false, ...props }) {
  return (
    <button {...props} disabled={loading || props.disabled}>
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          處理中...
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export default FullScreenLoader;
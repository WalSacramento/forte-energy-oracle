"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { truncateAddress } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AddressBadgeProps {
  address: string;
  chars?: number;
}

export function AddressBadge({ address, chars = 4 }: AddressBadgeProps) {
  const t = useTranslations("addressBadge");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Badge variant="outline" className="gap-1 pl-2 font-mono">
      <span>{truncateAddress(address, chars)}</span>
      <Button
        variant="ghost"
        size="icon-xs"
        className="size-5 rounded-full"
        onClick={handleCopy}
        aria-label={copied ? t("copied") : t("copyAddress")}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </Badge>
  );
}

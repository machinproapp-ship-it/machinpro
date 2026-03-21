"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { Language, Currency } from "@/lib/i18n";
import { LANG_META, CURRENCY_META } from "@/lib/i18n";

interface LocaleContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  formatAmount: (amount: number, cur?: Currency) => string;
  langMeta: typeof LANG_META;
  currencyMeta: typeof CURRENCY_META;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
  initialLanguage = "es",
  initialCurrency = "CAD",
}: {
  children: React.ReactNode;
  initialLanguage?: Language;
  initialCurrency?: Currency;
}) {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [currency, setCurrency] = useState<Currency>(initialCurrency);

  const formatAmount = useCallback((amount: number, cur?: Currency) => {
    const c = cur ?? currency;
    const meta = CURRENCY_META[c];
    const symbol = meta?.symbol ?? c;
    return `${symbol} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [currency]);

  const value: LocaleContextValue = {
    language,
    setLanguage,
    currency,
    setCurrency,
    formatAmount,
    langMeta: LANG_META,
    currencyMeta: CURRENCY_META,
  };

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

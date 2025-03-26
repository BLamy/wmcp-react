"use client"

import * as React from "react"
import {
  Shield,
  KeyRound,
  CreditCard,
  FileText,
  User,
  Command,
  Plus,
  Settings2,
  Building2,
  Mail,
  Phone,
  Globe,
  Wallet,
  Landmark,
  BadgeCheck,
  BookOpen,
  ChevronRight,
  LucideIcon,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface VaultItem {
  title: string
  url: string
  icon?: LucideIcon
}

interface VaultCategory {
  title: string
  icon: LucideIcon
  items: VaultItem[]
}

const vaultCategories: Record<string, VaultCategory> = {
  passwords: {
    title: "Passwords",
    icon: KeyRound,
    items: [
      { title: "Website Logins", url: "#" },
      { title: "App Passwords", url: "#" },
      { title: "Email Accounts", url: "#" },
    ],
  },
  payment: {
    title: "Payment Methods",
    icon: Wallet,
    items: [
      { title: "Credit Cards", icon: CreditCard, url: "#" },
      { title: "Bank Accounts", icon: Landmark, url: "#" },
    ],
  },
  notes: {
    title: "Secure Notes",
    icon: FileText,
    items: [
      { title: "Private Notes", url: "#" },
      { title: "Documents", url: "#" },
      { title: "Software Licenses", url: "#" },
    ],
  },
  personal: {
    title: "Personal Info",
    icon: User,
    items: [
      { title: "Names & Emails", icon: Mail, url: "#" },
      { title: "Phone Numbers", icon: Phone, url: "#" },
      { title: "Addresses", icon: Building2, url: "#" },
      { title: "Websites", icon: Globe, url: "#" },
    ],
  },
  identities: {
    title: "IDs & Licenses",
    icon: BadgeCheck,
    items: [
      { title: "Passports", icon: BookOpen, url: "#" },
      { title: "Driver's Licenses", icon: CreditCard, url: "#" },
      { title: "Other IDs", icon: BadgeCheck, url: "#" },
    ],
  },
}

export interface SecureVaultSidebarProps {
  onAddItem: () => void
  onSelectItem: (category: string, item?: string) => void
  selectedCategory: string
  itemCounts: Record<string, number>
}

export function SecureVaultSidebar({
  onAddItem,
  onSelectItem,
  selectedCategory,
  itemCounts,
  ...props
}: SecureVaultSidebarProps & React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="inset" {...props} className="bg-black">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="#" className="flex items-center gap-3">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Shield className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">SecureVault</span>
                  <span className="truncate text-xs text-muted-foreground">Password Manager</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <div className="px-2 py-2">
          <button
            onClick={onAddItem}
            className="w-full flex items-center gap-2 justify-center py-2 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
          >
            <Plus size={18} />
            <span>Add New Item</span>
          </button>
        </div>

        <div className="px-3 py-2">
          <h3 className="mb-2 px-2 text-xs font-medium tracking-wider text-muted-foreground">VAULT</h3>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => onSelectItem("All Items")}
                className={selectedCategory === "All Items" ? "bg-accent text-black" : "text-white"}
              >
                <Shield className="mr-2 size-4" />
                <span>All Items</span>
                {itemCounts.total > 0 && (
                  <span className="ml-auto rounded-full bg-muted text-black px-2 py-0.5 text-xs">
                    {itemCounts.total}
                  </span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>

            {Object.entries(vaultCategories).map(([key, category]) => (
              <Collapsible key={key}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      onClick={() => onSelectItem(category.title)}
                      className={selectedCategory === category.title ? "bg-accent text-black" : "text-white"}
                    >
                      <category.icon className="mr-2 size-4" />
                      <span>{category.title}</span>
                      {itemCounts[key] > 0 && (
                        <span className="ml-auto rounded-full bg-muted text-black px-2 py-0.5 text-xs">
                          {itemCounts[key]}
                        </span>
                      )}
                      <ChevronRight className="ml-2 size-4 shrink-0 transition-transform duration-200 data-[state=open]:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="pl-6 py-1">
                      {category.items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            onClick={() => onSelectItem(category.title, item.title)}
                            className={
                              selectedCategory === `${category.title}/${item.title}` ? "bg-accent text-black" : "text-white"
                            }
                          >
                            {item.icon && <item.icon className="mr-2 size-4" />}
                            <span>{item.title}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </div>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            ))}
          </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton>
              <Settings2 className="mr-2 size-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
} 
import { Appearance } from '@clerk/types';

// Light theme appearance configuration  
export const lightAppearance: Appearance = {
  baseTheme: undefined,
  variables: {
    // Main colors from DaisyUI light theme
    colorPrimary: 'hsl(var(--p))',
    colorBackground: 'hsl(var(--b1))', 
    colorInputBackground: 'hsl(var(--b1))',
    colorInputText: 'hsl(var(--bc))',
    colorText: 'hsl(var(--bc))',
    colorTextSecondary: 'hsl(var(--bc) / 0.7)',
    colorNeutral: 'hsl(var(--n))',
    colorSuccess: 'hsl(var(--su))',
    colorWarning: 'hsl(var(--wa))', 
    colorDanger: 'hsl(var(--er))',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    spacingUnit: '1rem',
  },
  elements: {
    card: 'bg-base-100 shadow-xl rounded-lg',
    headerTitle: 'text-2xl font-bold text-base-content',
    headerSubtitle: 'text-base-content/70',
    formButtonPrimary: 'btn btn-primary',
    formFieldInput: 'input input-bordered w-full',
    formFieldLabel: 'label-text font-medium',
    userButtonPopoverCard: 'bg-base-100 shadow-2xl border border-base-300 rounded-lg !important',
    userButtonPopoverActionButton: 'text-base-content hover:bg-base-200 !important',
    userButtonPopoverActionButtonText: 'text-base-content !important',
    userButtonPopoverActionButtonIcon: 'text-base-content/70 !important',
  },
};

// Dark theme appearance configuration
export const darkAppearance: Appearance = {
  baseTheme: undefined,
  variables: {
    // Main colors from DaisyUI dark theme
    colorPrimary: 'hsl(var(--p))',
    colorBackground: 'hsl(var(--b1))', 
    colorInputBackground: 'hsl(var(--b2))',
    colorInputText: 'hsl(var(--bc))',
    colorText: 'hsl(var(--bc))',
    colorTextSecondary: 'hsl(var(--bc) / 0.7)',
    colorNeutral: 'hsl(var(--n))',
    colorSuccess: 'hsl(var(--su))',
    colorWarning: 'hsl(var(--wa))', 
    colorDanger: 'hsl(var(--er))',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    spacingUnit: '1rem',
  },
  elements: {
    card: 'bg-base-100 shadow-xl rounded-lg border border-base-300',
    headerTitle: 'text-2xl font-bold text-base-content',
    headerSubtitle: 'text-base-content/70',
    formButtonPrimary: 'btn btn-primary',
    formFieldInput: 'input input-bordered w-full bg-base-200',
    formFieldLabel: 'label-text font-medium text-base-content',
    userButtonPopoverCard: 'bg-base-100 shadow-2xl border border-base-300 rounded-lg !important',
    userButtonPopoverActionButton: 'text-base-content hover:bg-base-200 !important',
    userButtonPopoverActionButtonText: 'text-base-content !important',
    userButtonPopoverActionButtonIcon: 'text-base-content/70 !important',
  },
};

// Polish localization for Clerk components
export const polishLocalization = {
  signIn: {
    start: {
      title: 'Zaloguj się',
      subtitle: 'aby kontynuować do ReadTube',
      actionText: 'Nie masz konta?',
      actionLink: 'Zarejestruj się',
    },
  },
  signUp: {
    start: {
      title: 'Utwórz konto',
      subtitle: 'aby kontynuować do ReadTube',
      actionText: 'Masz już konto?',
      actionLink: 'Zaloguj się',
    },
  },
  userButton: {
    action__manageAccount: 'Zarządzaj kontem',
    action__signOut: 'Wyloguj się',
  },
};

// Helper function to get appearance based on current theme
export const getClerkAppearance = (theme: string): Appearance => {
  return theme === 'dark' ? darkAppearance : lightAppearance;
};
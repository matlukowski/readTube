import { Appearance } from '@clerk/types';

// Light theme appearance configuration
export const lightAppearance: Appearance = {
  baseTheme: undefined,
  variables: {
    // Main colors from DaisyUI light theme
    colorPrimary: 'hsl(var(--p))', // DaisyUI primary
    colorPrimaryText: 'hsl(var(--pc))', // DaisyUI primary-content
    colorBackground: 'hsl(var(--b1))', // DaisyUI base-100
    colorInputBackground: 'hsl(var(--b1))', // DaisyUI base-100  
    colorInputText: 'hsl(var(--bc))', // DaisyUI base-content
    
    // Text colors
    colorText: 'hsl(var(--bc))', // DaisyUI base-content
    colorTextSecondary: 'hsl(var(--bc) / 0.7)', // Muted text
    colorTextOnPrimaryBackground: 'hsl(var(--pc))', // DaisyUI primary-content
    
    // Neutral colors
    colorNeutral: 'hsl(var(--n))', // DaisyUI neutral
    colorSuccess: 'hsl(var(--su))', // DaisyUI success
    colorWarning: 'hsl(var(--wa))', // DaisyUI warning  
    colorDanger: 'hsl(var(--er))', // DaisyUI error
    
    // Borders and dividers
    colorShimmer: 'hsl(var(--b2))', // DaisyUI base-200
    
    // Radius to match DaisyUI
    borderRadius: '0.5rem', // DaisyUI default rounded
    
    // Font family to match application
    fontFamily: 'Inter, ui-sans-serif, system-ui',
    fontFamilyButtons: 'Inter, ui-sans-serif, system-ui',
    
    // Font sizes
    fontSize: '0.875rem', // 14px
    fontSizeButtons: '0.875rem', // 14px
    
    // Spacing
    spacingUnit: '1rem',
  },
  elements: {
    // Main card container
    card: {
      backgroundColor: 'hsl(var(--b1))',
      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      borderRadius: '1rem', // DaisyUI card border radius
      border: '1px solid hsl(var(--b3))',
    },
    
    // Headers
    headerTitle: {
      color: 'hsl(var(--bc))',
      fontSize: '1.5rem',
      fontWeight: '700',
    },
    
    headerSubtitle: {
      color: 'hsl(var(--bc) / 0.7)',
      fontSize: '0.875rem',
    },
    
    // Form elements
    formButtonPrimary: {
      backgroundColor: 'hsl(var(--p))',
      color: 'hsl(var(--pc))',
      borderRadius: '0.5rem',
      fontSize: '0.875rem',
      fontWeight: '500',
      padding: '0.75rem 1rem',
      border: 'none',
      boxShadow: 'none',
      '&:hover': {
        backgroundColor: 'hsl(var(--p) / 0.9)',
        transform: 'none',
      },
      '&:focus': {
        outline: '2px solid hsl(var(--p) / 0.2)',
        outlineOffset: '2px',
      }
    },
    
    formFieldInput: {
      backgroundColor: 'hsl(var(--b1))',
      borderColor: 'hsl(var(--bc) / 0.2)',
      color: 'hsl(var(--bc))',
      borderRadius: '0.5rem',
      padding: '0.75rem 1rem',
      fontSize: '0.875rem',
      '&:focus': {
        borderColor: 'hsl(var(--p))',
        outline: 'none',
        boxShadow: '0 0 0 1px hsl(var(--p) / 0.2)',
      },
      '&::placeholder': {
        color: 'hsl(var(--bc) / 0.5)',
      }
    },
    
    formFieldLabel: {
      color: 'hsl(var(--bc))',
      fontSize: '0.875rem',
      fontWeight: '500',
      marginBottom: '0.375rem',
    },
    
    // Links
    identityPreviewText: {
      color: 'hsl(var(--bc) / 0.7)',
      fontSize: '0.875rem',
    },
    
    identityPreviewEditButton: {
      color: 'hsl(var(--p))',
      fontSize: '0.875rem',
      '&:hover': {
        color: 'hsl(var(--p) / 0.8)',
      }
    },
    
    // Footer links
    footerActionLink: {
      color: 'hsl(var(--p))',
      fontSize: '0.875rem',
      textDecoration: 'none',
      '&:hover': {
        color: 'hsl(var(--p) / 0.8)',
        textDecoration: 'underline',
      }
    },
    
    // Dividers
    dividerLine: {
      backgroundColor: 'hsl(var(--b3))',
      height: '1px',
    },
    
    dividerText: {
      color: 'hsl(var(--bc) / 0.6)',
      fontSize: '0.75rem',
    },
    
    // Social buttons
    socialButtonsBlockButton: {
      backgroundColor: 'hsl(var(--b1))',
      borderColor: 'hsl(var(--bc) / 0.2)',
      color: 'hsl(var(--bc))',
      borderRadius: '0.5rem',
      padding: '0.75rem 1rem',
      '&:hover': {
        backgroundColor: 'hsl(var(--b2))',
        borderColor: 'hsl(var(--bc) / 0.3)',
      }
    },
    
    // Alert messages
    alert: {
      backgroundColor: 'hsl(var(--er) / 0.1)',
      color: 'hsl(var(--er))',
      borderRadius: '0.5rem',
      padding: '0.75rem 1rem',
      fontSize: '0.875rem',
      border: '1px solid hsl(var(--er) / 0.2)',
    },
    
    // UserButton dropdown styling
    userButtonPopoverCard: {
      backgroundColor: 'hsl(var(--b1))',
      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      borderRadius: '0.75rem',
      border: '1px solid hsl(var(--b3))',
      minWidth: '200px',
    },
    
    userButtonPopoverActions: {
      backgroundColor: 'hsl(var(--b1))',
    },
    
    userButtonPopoverActionButton: {
      color: 'hsl(var(--bc))',
      fontSize: '0.875rem',
      fontWeight: '400',
      padding: '0.75rem 1rem',
      borderRadius: '0.5rem',
      backgroundColor: 'transparent',
      '&:hover': {
        backgroundColor: 'hsl(var(--b2))',
      },
      '&:focus': {
        backgroundColor: 'hsl(var(--b2))',
        outline: 'none',
      }
    },
    
    userButtonPopoverActionButtonIcon: {
      color: 'hsl(var(--bc) / 0.6)',
      width: '1rem',
      height: '1rem',
    },
    
    userButtonPopoverActionButtonText: {
      color: 'hsl(var(--bc))',
      fontSize: '0.875rem',
    },
    
    userButtonPopoverFooter: {
      backgroundColor: 'hsl(var(--b1))',
      borderTop: '1px solid hsl(var(--b3))',
      padding: '0.75rem 1rem',
    },
    
    avatarBox: {
      borderRadius: '50%',
      border: '2px solid hsl(var(--b3))',
      backgroundColor: 'hsl(var(--b1))',
    },
    
    userPreviewTextContainer: {
      backgroundColor: 'hsl(var(--b1))',
      padding: '0.75rem 1rem',
      borderBottom: '1px solid hsl(var(--b3))',
    },
    
    userPreviewMainIdentifier: {
      color: 'hsl(var(--bc))',
      fontSize: '0.875rem',
      fontWeight: '500',
    },
    
    userPreviewSecondaryIdentifier: {
      color: 'hsl(var(--bc) / 0.7)',
      fontSize: '0.75rem',
    },
    
    // Additional comprehensive dropdown styling
    rootBox: {
      backgroundColor: 'hsl(var(--b1))',
    },
    
    dropdownMenuContent: {
      backgroundColor: 'hsl(var(--b1))',
      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      borderRadius: '0.75rem',
      border: '1px solid hsl(var(--b3))',
      minWidth: '200px',
    },
    
    menuList: {
      backgroundColor: 'hsl(var(--b1))',
      padding: '0.5rem',
    },
    
    menuItem: {
      color: 'hsl(var(--bc))',
      backgroundColor: 'transparent',
      padding: '0.75rem 1rem',
      borderRadius: '0.5rem',
      fontSize: '0.875rem',
      '&:hover': {
        backgroundColor: 'hsl(var(--b2))',
      },
    },
    
    userButtonBox: {
      backgroundColor: 'hsl(var(--b1))',
    },
    
    userButtonTrigger: {
      backgroundColor: 'transparent',
      '&:hover': {
        backgroundColor: 'hsl(var(--b2) / 0.5)',
      },
    },
    
    userButtonAvatarBox: {
      border: '2px solid hsl(var(--b3))',
      backgroundColor: 'hsl(var(--b1))',
    },
    
    // Modal and popover fallbacks
    modalContent: {
      backgroundColor: 'hsl(var(--b1))',
      boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
      borderRadius: '1rem',
      border: '1px solid hsl(var(--b3))',
    },
    
    modalBackdrop: {
      backgroundColor: 'rgb(0 0 0 / 0.5)',
    },
    
    popover: {
      backgroundColor: 'hsl(var(--b1))',
      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      borderRadius: '0.75rem',
      border: '1px solid hsl(var(--b3))',
    },
    
    // UserProfile specific elements
    navbar: {
      backgroundColor: 'hsl(var(--b1))',
      borderBottom: '1px solid hsl(var(--b3))',
    },
    
    navbarButton: {
      color: 'hsl(var(--bc))',
      backgroundColor: 'transparent',
      '&:hover': {
        backgroundColor: 'hsl(var(--b2))',
      },
    },
    
    pageScrollBox: {
      backgroundColor: 'hsl(var(--b1))',
    }
  },
};

// Dark theme appearance configuration
export const darkAppearance: Appearance = {
  baseTheme: undefined,
  variables: {
    // Main colors from DaisyUI dark theme
    colorPrimary: 'hsl(var(--p))', // DaisyUI primary
    colorPrimaryText: 'hsl(var(--pc))', // DaisyUI primary-content
    colorBackground: 'hsl(var(--b1))', // DaisyUI base-100 (dark)
    colorInputBackground: 'hsl(var(--b1))', // DaisyUI base-100
    colorInputText: 'hsl(var(--bc))', // DaisyUI base-content
    
    // Text colors
    colorText: 'hsl(var(--bc))', // DaisyUI base-content
    colorTextSecondary: 'hsl(var(--bc) / 0.7)', // Muted text
    colorTextOnPrimaryBackground: 'hsl(var(--pc))', // DaisyUI primary-content
    
    // Neutral colors
    colorNeutral: 'hsl(var(--n))', // DaisyUI neutral
    colorSuccess: 'hsl(var(--su))', // DaisyUI success
    colorWarning: 'hsl(var(--wa))', // DaisyUI warning
    colorDanger: 'hsl(var(--er))', // DaisyUI error
    
    // Borders and dividers
    colorShimmer: 'hsl(var(--b2))', // DaisyUI base-200
    
    // Radius to match DaisyUI
    borderRadius: '0.5rem', // DaisyUI default rounded
    
    // Font family to match application
    fontFamily: 'Inter, ui-sans-serif, system-ui',
    fontFamilyButtons: 'Inter, ui-sans-serif, system-ui',
    
    // Font sizes
    fontSize: '0.875rem', // 14px
    fontSizeButtons: '0.875rem', // 14px
    
    // Spacing
    spacingUnit: '1rem',
  },
  elements: {
    // Main card container - same as light but uses dark theme CSS variables
    card: {
      backgroundColor: 'hsl(var(--b1))',
      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.25), 0 8px 10px -6px rgb(0 0 0 / 0.25)',
      borderRadius: '1rem',
      border: '1px solid hsl(var(--b3))',
    },
    
    // Headers - same structure, CSS variables handle the color switching
    headerTitle: {
      color: 'hsl(var(--bc))',
      fontSize: '1.5rem',
      fontWeight: '700',
    },
    
    headerSubtitle: {
      color: 'hsl(var(--bc) / 0.7)',
      fontSize: '0.875rem',
    },
    
    // Form elements - same structure as light theme
    formButtonPrimary: {
      backgroundColor: 'hsl(var(--p))',
      color: 'hsl(var(--pc))',
      borderRadius: '0.5rem',
      fontSize: '0.875rem',
      fontWeight: '500',
      padding: '0.75rem 1rem',
      border: 'none',
      boxShadow: 'none',
      '&:hover': {
        backgroundColor: 'hsl(var(--p) / 0.9)',
        transform: 'none',
      },
      '&:focus': {
        outline: '2px solid hsl(var(--p) / 0.2)',
        outlineOffset: '2px',
      }
    },
    
    formFieldInput: {
      backgroundColor: 'hsl(var(--b1))',
      borderColor: 'hsl(var(--bc) / 0.2)',
      color: 'hsl(var(--bc))',
      borderRadius: '0.5rem',
      padding: '0.75rem 1rem',
      fontSize: '0.875rem',
      '&:focus': {
        borderColor: 'hsl(var(--p))',
        outline: 'none',
        boxShadow: '0 0 0 1px hsl(var(--p) / 0.2)',
      },
      '&::placeholder': {
        color: 'hsl(var(--bc) / 0.5)',
      }
    },
    
    formFieldLabel: {
      color: 'hsl(var(--bc))',
      fontSize: '0.875rem',
      fontWeight: '500',
      marginBottom: '0.375rem',
    },
    
    // Links
    identityPreviewText: {
      color: 'hsl(var(--bc) / 0.7)',
      fontSize: '0.875rem',
    },
    
    identityPreviewEditButton: {
      color: 'hsl(var(--p))',
      fontSize: '0.875rem',
      '&:hover': {
        color: 'hsl(var(--p) / 0.8)',
      }
    },
    
    // Footer links
    footerActionLink: {
      color: 'hsl(var(--p))',
      fontSize: '0.875rem',
      textDecoration: 'none',
      '&:hover': {
        color: 'hsl(var(--p) / 0.8)',
        textDecoration: 'underline',
      }
    },
    
    // Dividers
    dividerLine: {
      backgroundColor: 'hsl(var(--b3))',
      height: '1px',
    },
    
    dividerText: {
      color: 'hsl(var(--bc) / 0.6)',
      fontSize: '0.75rem',
    },
    
    // Social buttons
    socialButtonsBlockButton: {
      backgroundColor: 'hsl(var(--b1))',
      borderColor: 'hsl(var(--bc) / 0.2)',
      color: 'hsl(var(--bc))',
      borderRadius: '0.5rem',
      padding: '0.75rem 1rem',
      '&:hover': {
        backgroundColor: 'hsl(var(--b2))',
        borderColor: 'hsl(var(--bc) / 0.3)',
      }
    },
    
    // Alert messages
    alert: {
      backgroundColor: 'hsl(var(--er) / 0.1)',
      color: 'hsl(var(--er))',
      borderRadius: '0.5rem',
      padding: '0.75rem 1rem',
      fontSize: '0.875rem',
      border: '1px solid hsl(var(--er) / 0.2)',
    },
    
    // UserButton dropdown styling - same as light theme since we use CSS variables
    userButtonPopoverCard: {
      backgroundColor: 'hsl(var(--b1))',
      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.25), 0 8px 10px -6px rgb(0 0 0 / 0.25)',
      borderRadius: '0.75rem',
      border: '1px solid hsl(var(--b3))',
      minWidth: '200px',
    },
    
    userButtonPopoverActions: {
      backgroundColor: 'hsl(var(--b1))',
    },
    
    userButtonPopoverActionButton: {
      color: 'hsl(var(--bc))',
      fontSize: '0.875rem',
      fontWeight: '400',
      padding: '0.75rem 1rem',
      borderRadius: '0.5rem',
      backgroundColor: 'transparent',
      '&:hover': {
        backgroundColor: 'hsl(var(--b2))',
      },
      '&:focus': {
        backgroundColor: 'hsl(var(--b2))',
        outline: 'none',
      }
    },
    
    userButtonPopoverActionButtonIcon: {
      color: 'hsl(var(--bc) / 0.6)',
      width: '1rem',
      height: '1rem',
    },
    
    userButtonPopoverActionButtonText: {
      color: 'hsl(var(--bc))',
      fontSize: '0.875rem',
    },
    
    userButtonPopoverFooter: {
      backgroundColor: 'hsl(var(--b1))',
      borderTop: '1px solid hsl(var(--b3))',
      padding: '0.75rem 1rem',
    },
    
    avatarBox: {
      borderRadius: '50%',
      border: '2px solid hsl(var(--b3))',
      backgroundColor: 'hsl(var(--b1))',
    },
    
    userPreviewTextContainer: {
      backgroundColor: 'hsl(var(--b1))',
      padding: '0.75rem 1rem',
      borderBottom: '1px solid hsl(var(--b3))',
    },
    
    userPreviewMainIdentifier: {
      color: 'hsl(var(--bc))',
      fontSize: '0.875rem',
      fontWeight: '500',
    },
    
    userPreviewSecondaryIdentifier: {
      color: 'hsl(var(--bc) / 0.7)',
      fontSize: '0.75rem',
    },
    
    // Additional comprehensive dropdown styling - same as light theme
    rootBox: {
      backgroundColor: 'hsl(var(--b1))',
    },
    
    dropdownMenuContent: {
      backgroundColor: 'hsl(var(--b1))',
      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.25), 0 8px 10px -6px rgb(0 0 0 / 0.25)',
      borderRadius: '0.75rem',
      border: '1px solid hsl(var(--b3))',
      minWidth: '200px',
    },
    
    menuList: {
      backgroundColor: 'hsl(var(--b1))',
      padding: '0.5rem',
    },
    
    menuItem: {
      color: 'hsl(var(--bc))',
      backgroundColor: 'transparent',
      padding: '0.75rem 1rem',
      borderRadius: '0.5rem',
      fontSize: '0.875rem',
      '&:hover': {
        backgroundColor: 'hsl(var(--b2))',
      },
    },
    
    userButtonBox: {
      backgroundColor: 'hsl(var(--b1))',
    },
    
    userButtonTrigger: {
      backgroundColor: 'transparent',
      '&:hover': {
        backgroundColor: 'hsl(var(--b2) / 0.5)',
      },
    },
    
    userButtonAvatarBox: {
      border: '2px solid hsl(var(--b3))',
      backgroundColor: 'hsl(var(--b1))',
    },
    
    // Modal and popover fallbacks
    modalContent: {
      backgroundColor: 'hsl(var(--b1))',
      boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
      borderRadius: '1rem',
      border: '1px solid hsl(var(--b3))',
    },
    
    modalBackdrop: {
      backgroundColor: 'rgb(0 0 0 / 0.5)',
    },
    
    popover: {
      backgroundColor: 'hsl(var(--b1))',
      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.25), 0 8px 10px -6px rgb(0 0 0 / 0.25)',
      borderRadius: '0.75rem',
      border: '1px solid hsl(var(--b3))',
    },
    
    // UserProfile specific elements
    navbar: {
      backgroundColor: 'hsl(var(--b1))',
      borderBottom: '1px solid hsl(var(--b3))',
    },
    
    navbarButton: {
      color: 'hsl(var(--bc))',
      backgroundColor: 'transparent',
      '&:hover': {
        backgroundColor: 'hsl(var(--b2))',
      },
    },
    
    pageScrollBox: {
      backgroundColor: 'hsl(var(--b1))',
    }
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
    password: {
      title: 'Wprowadź hasło',
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
    emailCode: {
      title: 'Zweryfikuj swój adres e-mail',
      subtitle: 'aby kontynuować do ReadTube',
      formTitle: 'Kod weryfikacyjny',
      formSubtitle: 'Wprowadź kod weryfikacyjny wysłany na twój e-mail',
      resendButton: 'Nie otrzymałeś kodu? Wyślij ponownie',
    },
  },
  userButton: {
    action__manageAccount: 'Zarządzaj kontem',
    action__signOut: 'Wyloguj się',
    action__addAccount: 'Dodaj konto',
  },
  formFieldLabel__emailAddress: 'Adres e-mail',
  formFieldLabel__password: 'Hasło',
  formFieldLabel__confirmPassword: 'Potwierdź hasło',
  formFieldLabel__firstName: 'Imię',
  formFieldLabel__lastName: 'Nazwisko',
  formButtonPrimary: 'Kontynuuj',
  dividerText: 'lub',
  socialButtonsBlockButton: 'Kontynuuj z {{provider}}',
};

// Helper function to get appearance based on current theme
export const getClerkAppearance = (theme: string): Appearance => {
  return theme === 'dark' ? darkAppearance : lightAppearance;
};
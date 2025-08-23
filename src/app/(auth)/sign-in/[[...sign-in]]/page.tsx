import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <SignIn 
        redirectUrl="/analyze"
        afterSignInUrl="/analyze"
        routing="path"
        path="/sign-in"
      />
    </div>
  );
}
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <SignUp 
        redirectUrl="/analyze"
        afterSignUpUrl="/analyze"
        routing="path"
        path="/sign-up"
      />
    </div>
  );
}
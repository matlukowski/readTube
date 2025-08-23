import { UserProfile } from "@clerk/nextjs";

export default function UserProfilePage() {
  return (
    <div className="min-h-screen bg-base-200 py-8">
      <div className="container mx-auto px-4">
        <div className="flex justify-center">
          <UserProfile 
            routing="path"
            path="/user-profile"
          />
        </div>
      </div>
    </div>
  );
}
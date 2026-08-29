import { SectionHeading } from '../../components/ui'
import { ProfileCard } from '../../components/ProfileCard'

export function ProfileSection({ user }) {
  return (
    <div className="setting-section" id="settings-profile">
      <SectionHeading
        title="Profile"
        description="Your personal information and account role."
      />
      <ProfileCard user={user} />
    </div>
  )
}

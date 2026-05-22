import { useOutletContext } from "react-router-dom";
import { CommunityOutletContext } from "@/components/community-leader/CommunityLeaderLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCommunityDetail } from "@/hooks/use-community-leader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Shield, User } from "lucide-react";

const ROLES = [
  { key: "mwenyekiti", label: "Mwenyekiti", desc: "Chairperson" },
  { key: "makamu_mwenyekiti", label: "Makamu Mwenyekiti", desc: "Vice Chairperson" },
  { key: "katibu", label: "Katibu", desc: "Secretary" },
  { key: "mweka_hazina", label: "Mweka Hazina", desc: "Treasurer" },
] as const;

export default function CommunityLeadershipPage() {
  const { communityId, community } = useOutletContext<CommunityOutletContext>();
  const { data: detail } = useCommunityDetail(communityId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-serif">Leadership Structure</h1>
        <p className="text-sm text-muted-foreground">{community?.name}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ROLES.map((role) => {
          const leader = detail?.[role.key] as any;
          return (
            <Card key={role.key}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 border-2 border-primary/20">
                    {leader?.photo_url ? (
                      <AvatarImage src={leader.photo_url} alt={leader.full_name} />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <User className="h-6 w-6" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs border-primary/30 text-primary">{role.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{role.desc}</p>
                    {leader ? (
                      <>
                        <p className="text-sm font-semibold mt-1 truncate">{leader.full_name}</p>
                        {leader.phone && (
                          <p className="text-xs text-muted-foreground">{leader.phone}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1 italic">Not assigned</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            About Community Leadership
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Leadership assignments are managed by Church Administration. If changes are needed,
            please contact your Church Admin. Leaders have access to community-scoped management
            features including member management, contribution recording, and community reports.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

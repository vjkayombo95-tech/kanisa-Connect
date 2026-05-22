import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type MemberOption = {
  id: string;
  full_name: string;
  community_id?: string | null;
};

type CommunityOption = {
  id: string;
  name: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  members: MemberOption[];
  communities?: CommunityOption[];
  defaultCommunityId?: string | null;
  lockCommunity?: boolean;
  allowTargetAmount?: boolean;
  isSubmitting?: boolean;
  onSubmit: (values: { memberId: string; communityId: string | null; amountPledged: number; targetAmount: number | null }) => Promise<void> | void;
}

export function PledgeCreateDialog({
  open,
  onOpenChange,
  title,
  description,
  members,
  communities = [],
  defaultCommunityId = null,
  lockCommunity = false,
  allowTargetAmount = false,
  isSubmitting,
  onSubmit,
}: Props) {
  const [memberId, setMemberId] = useState("");
  const [communityId, setCommunityId] = useState(defaultCommunityId || "");
  const [amountPledged, setAmountPledged] = useState("");
  const [targetAmount, setTargetAmount] = useState("");

  useEffect(() => {
    if (open) {
      setCommunityId(defaultCommunityId || "");
    }
  }, [defaultCommunityId, open]);

  const selectedMember = useMemo(
    () => members.find((member) => member.id === memberId),
    [memberId, members],
  );

  useEffect(() => {
    if (!lockCommunity && selectedMember?.community_id) {
      setCommunityId(selectedMember.community_id);
    }
  }, [lockCommunity, selectedMember?.community_id]);

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setMemberId("");
      setCommunityId(defaultCommunityId || "");
      setAmountPledged("");
      setTargetAmount("");
    }
    onOpenChange(nextOpen);
  };

  const numericAmount = Number(amountPledged || 0);
  const numericTarget = targetAmount ? Number(targetAmount) : null;
  const disabled = !memberId || !numericAmount || numericAmount <= 0 || !!isSubmitting;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Member</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Community</Label>
            <Select value={communityId} onValueChange={setCommunityId} disabled={lockCommunity}>
              <SelectTrigger>
                <SelectValue placeholder="Choose community" />
              </SelectTrigger>
              <SelectContent>
                {communities.map((community) => (
                  <SelectItem key={community.id} value={community.id}>
                    {community.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Amount Pledged (TZS)</Label>
            <Input
              type="number"
              min="1"
              value={amountPledged}
              onChange={(event) => setAmountPledged(event.target.value)}
              placeholder="Enter pledge amount"
            />
          </div>

          {allowTargetAmount ? (
            <div className="space-y-2">
              <Label>Community Target Amount (Optional)</Label>
              <Input
                type="number"
                min="0"
                value={targetAmount}
                onChange={(event) => setTargetAmount(event.target.value)}
                placeholder="Set or raise the community target"
              />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={!!isSubmitting}>
            Cancel
          </Button>
          <Button
            disabled={disabled}
            onClick={async () => {
              await onSubmit({
                memberId,
                communityId: communityId || null,
                amountPledged: numericAmount,
                targetAmount: numericTarget,
              });
              handleClose(false);
            }}
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Pledge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

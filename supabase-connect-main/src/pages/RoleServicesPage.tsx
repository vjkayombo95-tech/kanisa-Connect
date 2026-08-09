import { RoleMobileServiceDirectory } from "@/components/workspace/RoleMobileExperience";
import { useVisibleNavigationGroups, useWorkspaceContext } from "@/components/workspace/framework";

export default function RoleServicesPage() {
  const context = useWorkspaceContext();
  const groups = useVisibleNavigationGroups(context?.workspace.navigation ?? []);
  if (!context) return null;

  return (
    <>
      <RoleMobileServiceDirectory workspace={context.workspace} groups={groups} />
      <div className="hidden lg:block">
        <h1 className="text-2xl font-semibold">Huduma zote</h1>
        <p className="mt-2 text-muted-foreground">Tumia menyu ya pembeni kufungua huduma ya nafasi hii.</p>
      </div>
    </>
  );
}

/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import {
  attachUserPolicy,
  deleteUserInlinePolicy,
  detachUserPolicy,
  listUserInlinePolicies,
  listUserPolicies,
  putUserInlinePolicy,
} from "../../api/managerIamUsers";
import ManagerEntityPoliciesPage from "./ManagerEntityPoliciesPage";
import { useManagerText } from "./managerI18n";
import { managerIamUsersZhMessages } from "./managerIamUsersMessages";

export default function ManagerUserPoliciesPage() {
  const { t } = useManagerText(managerIamUsersZhMessages);
  return (
    <ManagerEntityPoliciesPage
      entityType="user"
      routeParam="userName"
      listPoliciesForEntity={listUserPolicies}
      attachPolicyToEntity={attachUserPolicy}
      detachPolicyFromEntity={detachUserPolicy}
      listInlinePoliciesForEntity={listUserInlinePolicies}
      putInlinePolicyForEntity={putUserInlinePolicy}
      deleteInlinePolicyForEntity={deleteUserInlinePolicy}
      extraActions={(entityName) => [
        {
          label: t("Access keys"),
          to: `/manager/users/${encodeURIComponent(entityName)}/keys`,
          variant: "ghost",
        },
      ]}
    />
  );
}

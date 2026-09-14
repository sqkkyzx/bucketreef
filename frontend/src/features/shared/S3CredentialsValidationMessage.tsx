/*
 * Copyright (c) 2026 Laurent Barbe
 * Licensed under the Apache License, Version 2.0
 */
import UiInlineMessage from "../../components/ui/UiInlineMessage";
import type { S3CredentialsValidationResult } from "../../api/s3CredentialsValidation";
import type { LiveS3CredentialsValidationState } from "./useLiveS3CredentialsValidation";
import { useS3ConnectionText } from "./s3ConnectionMessages";

type S3CredentialsValidationMessageProps = {
  validation: LiveS3CredentialsValidationState;
  className?: string;
};

function validationTone(severity: S3CredentialsValidationResult["severity"]) {
  if (severity === "success") return "success";
  if (severity === "warning") return "warning";
  return "error";
}

export default function S3CredentialsValidationMessage({
  validation,
  className,
}: S3CredentialsValidationMessageProps) {
  const { t } = useS3ConnectionText();
  if (validation.status === "loading") {
    return (
      <UiInlineMessage tone="info" className={className}>
        {t("Validating credentials...")}
      </UiInlineMessage>
    );
  }

  if (validation.status === "done" && validation.result) {
    return (
      <UiInlineMessage tone={validationTone(validation.result.severity)} className={className}>
        {t(validation.result.message)}
      </UiInlineMessage>
    );
  }

  return null;
}

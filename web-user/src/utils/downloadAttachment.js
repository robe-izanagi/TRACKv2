import apiClient from "../api/client";

const getDownloadErrorMessage = async (error) => {
  const responseData = error.response?.data;
  if (responseData instanceof Blob) {
    try {
      const data = JSON.parse(await responseData.text());
      if (data.message) return data.message;
    } catch {
      // The response was not a JSON error payload.
    }
  }

  return error.response?.data?.message || error.message ||
    "We could not download this attachment. Please try again.";
};

export const downloadAttachment = async (attachment) => {
  try {
    const response = await apiClient.get(
      `/attachments/download/${encodeURIComponent(attachment.id)}`,
      { responseType: "blob" },
    );
    const contentType = response.headers["content-type"]?.toLowerCase() || "";
    if (
      contentType.includes("text/html") ||
      contentType.includes("application/json")
    ) {
      throw new Error(
        "The server returned a web page instead of the attachment. Refresh the website and try again. If this continues, the web-user deployment may still be using an older build.",
      );
    }

    const objectUrl = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = attachment.file_name || "attachment";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (error) {
    window.alert(await getDownloadErrorMessage(error));
  }
};

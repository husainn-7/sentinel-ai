
from urllib.parse import urlsplit

from starlette.responses import JSONResponse

from backend.config import (
    MAX_REQUEST_BODY_BYTES,
    TRUSTED_HOSTS,
    TRUSTED_ORIGINS,
    STATE_CHANGING_METHODS,
    SECURITY_HEADERS,
)


# =========================================
# SECURITY MIDDLEWARE
# =========================================

class SecurityMiddleware:

    def __init__(
        self,
        app,
        max_body_bytes=MAX_REQUEST_BODY_BYTES,
        trusted_hosts=TRUSTED_HOSTS,
        trusted_origins=TRUSTED_ORIGINS,
    ):

        self.app = app

        self.max_body_bytes = max_body_bytes

        self.trusted_hosts = {
            host.lower()
            for host in trusted_hosts
        }

        self.trusted_origins = set(
            trusted_origins
        )


    # =====================================
    # SECURITY RESPONSE HEADERS
    # =====================================

    async def send_secure_response(
        self,
        message,
        send,
    ):

        if message["type"] == "http.response.start":

            protected_headers = {
                name.lower().encode("latin-1"):
                value.encode("latin-1")
                for name, value in SECURITY_HEADERS.items()
            }

            headers = [
                (name, value)
                for name, value in message.get(
                    "headers", []
                )
                if name.lower() not in protected_headers
            ]

            headers.extend(
                protected_headers.items()
            )

            message = {
                **message,
                "headers": headers,
            }

        await send(message)


    # =====================================
    # ERROR RESPONSE
    # =====================================

    async def reject(
        self,
        scope,
        receive,
        send,
        status_code,
        detail,
    ):

        response = JSONResponse(
            status_code=status_code,
            content={
                "detail": detail,
            },
            headers=SECURITY_HEADERS,
        )

        await response(
            scope,
            receive,
            send,
        )


    # =====================================
    # HOST VALIDATION
    # =====================================

    def is_trusted_host(self, host):

        try:

            if not host or any(
                character.isspace()
                for character in host
            ):

                return False

            if any(
                character in host
                for character in "/\\@?#"
            ):

                return False

            parsed = urlsplit(
                f"http://{host}"
            )

            hostname = parsed.hostname

            # Accessing port also validates its format.
            parsed.port

            if not hostname:

                return False

            hostname = hostname.lower()

            if ":" in hostname:

                hostname = f"[{hostname}]"

            return hostname in self.trusted_hosts

        except ValueError:

            return False


    # =====================================
    # MAIN REQUEST PROCESSING
    # =====================================

    async def __call__(
        self,
        scope,
        receive,
        send,
    ):

        if scope["type"] != "http":

            await self.app(
                scope,
                receive,
                send,
            )

            return


        # =================================
        # EXTRACT REQUEST INFORMATION
        # =================================

        headers = {}

        for name, value in scope.get(
            "headers", []
        ):

            key = name.decode(
                "latin-1"
            ).lower()

            headers.setdefault(
                key, []
            ).append(
                value.decode("latin-1")
            )

        method = scope.get(
            "method", "GET"
        ).upper()


        # =================================
        # VALIDATE HOST HEADER
        # =================================

        host_values = headers.get(
            "host", []
        )

        if (
            len(host_values) != 1
            or not self.is_trusted_host(
                host_values[0]
            )
        ):

            await self.reject(
                scope,
                receive,
                send,
                400,
                "Untrusted or invalid Host header.",
            )

            return


        # =================================
        # VALIDATE BROWSER ORIGIN
        # =================================

        origin_values = headers.get(
            "origin", []
        )

        if origin_values:

            if (
                len(origin_values) != 1
                or origin_values[0]
                not in self.trusted_origins
            ):

                await self.reject(
                    scope,
                    receive,
                    send,
                    403,
                    "Request origin is not trusted.",
                )

                return


        # =================================
        # CROSS-SITE REQUEST PROTECTION
        # =================================

        fetch_site = headers.get(
            "sec-fetch-site", []
        )

        if method in STATE_CHANGING_METHODS:

            if any(
                value.lower() == "cross-site"
                for value in fetch_site
            ):

                await self.reject(
                    scope,
                    receive,
                    send,
                    403,
                    "Cross-site requests are not allowed.",
                )

                return


        # =================================
        # VALIDATE CONTENT LENGTH
        # =================================

        declared_length = None

        length_values = headers.get(
            "content-length", []
        )

        if length_values:

            try:

                if len(length_values) != 1:

                    raise ValueError()

                raw_length = length_values[0]

                if (
                    not raw_length.isascii()
                    or not raw_length.isdecimal()
                ):

                    raise ValueError()

                declared_length = int(
                    raw_length
                )

            except ValueError:

                await self.reject(
                    scope,
                    receive,
                    send,
                    400,
                    "Invalid Content-Length header.",
                )

                return

            if declared_length > self.max_body_bytes:

                await self.reject(
                    scope,
                    receive,
                    send,
                    413,
                    "Request body exceeds the allowed size.",
                )

                return


        # =================================
        # REJECT AMBIGUOUS BODY FRAMING
        # =================================

        if (
            length_values
            and headers.get("transfer-encoding")
        ):

            await self.reject(
                scope,
                receive,
                send,
                400,
                "Ambiguous request body framing.",
            )

            return


        # =================================
        # ENFORCE ACTUAL BODY SIZE
        # =================================

        body = bytearray()

        while True:

            message = await receive()

            if message["type"] == "http.disconnect":

                return

            if message["type"] != "http.request":

                continue

            chunk = message.get(
                "body", b""
            )

            if (
                len(body) + len(chunk)
                > self.max_body_bytes
            ):

                await self.reject(
                    scope,
                    receive,
                    send,
                    413,
                    "Request body exceeds the allowed size.",
                )

                return

            body.extend(chunk)

            if not message.get(
                "more_body", False
            ):

                break


        # =================================
        # VERIFY DECLARED BODY LENGTH
        # =================================

        if (
            declared_length is not None
            and declared_length != len(body)
        ):

            await self.reject(
                scope,
                receive,
                send,
                400,
                "Request body length does not match Content-Length.",
            )

            return


        # =================================
        # REPLAY VALIDATED REQUEST BODY
        # =================================

        validated_body = bytes(body)

        del body

        body_delivered = False

        async def secure_receive():

            nonlocal body_delivered

            if not body_delivered:

                body_delivered = True

                return {
                    "type": "http.request",
                    "body": validated_body,
                    "more_body": False,
                }

            return await receive()


        # =================================
        # APPLY SECURITY RESPONSE HEADERS
        # =================================

        async def secure_send(message):

            await self.send_secure_response(
                message,
                send,
            )


        # =================================
        # FORWARD VALIDATED REQUEST
        # =================================

        await self.app(
            scope,
            secure_receive,
            secure_send,
        )

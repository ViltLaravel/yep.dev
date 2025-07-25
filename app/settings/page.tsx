export default function Page({searchParams}:{searchParams: {canceled: boolean, success: boolean}}) {
    return <div>
        { searchParams.success ? "Success" : "Canceled" }
    </div>
}